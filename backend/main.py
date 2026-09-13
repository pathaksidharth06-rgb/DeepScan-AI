"""
DeepScan AI - FastAPI Inference & Decision Support Server
ONNX Runtime version for low-memory deployment.

Uses:
    backend/best.onnx

Keeps the existing frontend-compatible API:
    GET  /health
    POST /predict
    POST /predict-batch
    GET  /scans
    DELETE /scans
    DELETE /scans/{scan_id}
    POST /feedback
"""

import os
import uuid
import base64
import io
import time
from datetime import datetime

import numpy as np
import onnxruntime as ort

from PIL import Image, ImageDraw, ImageFont

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from intelligence import get_intelligence
from sonar_quality import analyze_sonar_image_quality

import database


# ============================================================
# APP
# ============================================================

app = FastAPI(
    title="DeepScan AI - Underwater Sonar Intelligence API",
    version="2.1.0",
    description="ONNX Runtime YOLO11n inference and decision-support API for Side-Scan Sonar imagery",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# PATHS
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

MODEL_PATH = os.path.join(BASE_DIR, "best.onnx")

OUTPUTS_DIR = os.path.join(BASE_DIR, "outputs")
os.makedirs(OUTPUTS_DIR, exist_ok=True)

app.mount(
    "/outputs",
    StaticFiles(directory=OUTPUTS_DIR),
    name="outputs"
)


# ============================================================
# CONFIGURATION
# ============================================================

BACKEND_PUBLIC_URL = os.getenv(
    "BACKEND_PUBLIC_URL",
    "https://deepscan-ai-tyvx.onrender.com"
).rstrip("/")

CONFIDENCE_THRESHOLD = 0.20
NMS_IOU_THRESHOLD = 0.45
MAX_DETECTIONS = 10


# ============================================================
# CLASS NAMES
# ============================================================

CLASS_NAMES = {
    0: "Fishing Net",
    1: "Crab Pot",
    2: "Shipwreck",
    3: "Pipe",
    4: "Rope",
    5: "Tire",
    6: "Weight",
    7: "Block",
    8: "Artificial Reef",
    9: "Pipeline/Cylinder",
    10: "Boulder",
}


# ============================================================
# LOAD ONNX MODEL
# ============================================================

if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"ONNX model not found: {MODEL_PATH}. "
        "Make sure backend/best.onnx exists."
    )


print("Loading ONNX model from best.onnx...")

session = ort.InferenceSession(
    MODEL_PATH,
    providers=["CPUExecutionProvider"],
)

input_meta = session.get_inputs()[0]
INPUT_NAME = input_meta.name
INPUT_SHAPE = input_meta.shape

# Usually YOLO ONNX is [1, 3, 256, 256] or [1, 3, 640, 640]
try:
    INPUT_HEIGHT = int(INPUT_SHAPE[2])
    INPUT_WIDTH = int(INPUT_SHAPE[3])
except Exception:
    INPUT_HEIGHT = 256
    INPUT_WIDTH = 256

print(
    f"ONNX model loaded successfully. "
    f"Input: {INPUT_WIDTH}x{INPUT_HEIGHT}"
)

print(f"Classes: {CLASS_NAMES}")


# ============================================================
# DATABASE STARTUP
# ============================================================

@app.on_event("startup")
def startup():
    database.init_db()


# ============================================================
# HEALTH
# ============================================================

@app.get("/")
def root():
    return {
        "status": "ONLINE",
        "service": "DeepScan AI",
        "model": "YOLO11n ONNX (best.onnx)",
        "runtime": "ONNX Runtime",
    }


@app.get("/health")
def health_check():
    return {
        "status": "ONLINE",
        "model": "YOLO11n ONNX (best.onnx)",
        "runtime": "ONNX Runtime CPU",
        "classes": CLASS_NAMES,
        "taxonomy_classes": len(CLASS_NAMES),
        "input_size": {
            "width": INPUT_WIDTH,
            "height": INPUT_HEIGHT,
        },
        "sonar_quality_analyzer": "ACTIVE",
        "quality_modules": [
            "speckle_noise",
            "resolution_quality",
            "acoustic_shadow",
            "motion_dropout",
            "evidence_score",
        ],
    }


# ============================================================
# IMAGE PREPROCESSING
# ============================================================

def letterbox_image(image: Image.Image):
    """
    Resize image while preserving aspect ratio.
    Pads the image to the ONNX model input size.
    """

    original_width, original_height = image.size

    scale = min(
        INPUT_WIDTH / original_width,
        INPUT_HEIGHT / original_height
    )

    new_width = max(1, int(round(original_width * scale)))
    new_height = max(1, int(round(original_height * scale)))

    resized = image.resize(
        (new_width, new_height),
        Image.Resampling.BILINEAR
    )

    canvas = Image.new(
        "RGB",
        (INPUT_WIDTH, INPUT_HEIGHT),
        (114, 114, 114)
    )

    pad_x = (INPUT_WIDTH - new_width) // 2
    pad_y = (INPUT_HEIGHT - new_height) // 2

    canvas.paste(
        resized,
        (pad_x, pad_y)
    )

    image_array = np.asarray(canvas).astype(np.float32)

    # HWC -> CHW
    image_array = image_array.transpose(2, 0, 1)

    # 0-255 -> 0-1
    image_array /= 255.0

    # Add batch dimension
    image_array = np.expand_dims(image_array, axis=0)

    return (
        image_array,
        scale,
        pad_x,
        pad_y,
        original_width,
        original_height,
    )


# ============================================================
# IOU
# ============================================================

def calculate_iou(box_a, box_b):
    """
    Calculate Intersection over Union.
    """

    ax1, ay1, ax2, ay2 = box_a
    bx1, by1, bx2, by2 = box_b

    inter_x1 = max(ax1, bx1)
    inter_y1 = max(ay1, by1)
    inter_x2 = min(ax2, bx2)
    inter_y2 = min(ay2, by2)

    inter_width = max(0.0, inter_x2 - inter_x1)
    inter_height = max(0.0, inter_y2 - inter_y1)

    intersection = inter_width * inter_height

    area_a = max(0.0, ax2 - ax1) * max(0.0, ay2 - ay1)
    area_b = max(0.0, bx2 - bx1) * max(0.0, by2 - by1)

    union = area_a + area_b - intersection

    if union <= 0:
        return 0.0

    return intersection / union


# ============================================================
# NMS
# ============================================================

def non_max_suppression(
    boxes,
    scores,
    class_ids,
    iou_threshold=0.45,
    max_detections=10,
):
    """
    Class-aware Non-Maximum Suppression.
    """

    if len(boxes) == 0:
        return []

    boxes = np.asarray(boxes, dtype=np.float32)
    scores = np.asarray(scores, dtype=np.float32)
    class_ids = np.asarray(class_ids, dtype=np.int32)

    keep = []

    # Process each class separately
    unique_classes = np.unique(class_ids)

    for class_id in unique_classes:

        indices = np.where(class_ids == class_id)[0]

        # Highest confidence first
        indices = indices[
            np.argsort(scores[indices])[::-1]
        ]

        while len(indices) > 0:

            current = indices[0]

            keep.append(int(current))

            if len(keep) >= max_detections:
                break

            remaining = []

            for idx in indices[1:]:

                iou = calculate_iou(
                    boxes[current],
                    boxes[idx]
                )

                if iou < iou_threshold:
                    remaining.append(idx)

            indices = np.asarray(
                remaining,
                dtype=np.int32
            )

        if len(keep) >= max_detections:
            break

    # Sort final detections by confidence
    keep = sorted(
        keep,
        key=lambda i: float(scores[i]),
        reverse=True
    )

    return keep[:max_detections]


# ============================================================
# ONNX INFERENCE
# ============================================================

def run_onnx_inference(image: Image.Image):
    """
    Run YOLO ONNX inference.

    Expected YOLO export output:
        [1, 4 + number_of_classes, number_of_predictions]

    For 11 classes:
        [1, 15, N]
    """

    (
        input_tensor,
        scale,
        pad_x,
        pad_y,
        original_width,
        original_height,
    ) = letterbox_image(image)

    start = time.perf_counter()

    outputs = session.run(
        None,
        {
            INPUT_NAME: input_tensor
        }
    )

    inference_time_ms = int(
        (time.perf_counter() - start) * 1000
    )

    if not outputs:
        return [], inference_time_ms

    output = outputs[0]

    output = np.asarray(output)

    # Remove batch dimension
    if output.ndim == 3:
        output = output[0]

    # YOLO commonly returns [channels, predictions]
    # Convert to [predictions, channels]
    if output.shape[0] < output.shape[1]:
        output = output.transpose(1, 0)

    number_of_channels = output.shape[1]

    expected_channels = 4 + len(CLASS_NAMES)

    if number_of_channels < expected_channels:
        raise RuntimeError(
            f"Unexpected ONNX output shape: {output.shape}. "
            f"Expected at least {expected_channels} channels."
        )

    # First four values are xywh
    boxes_xywh = output[:, :4]

    # Remaining values are class confidence scores
    class_scores = output[:, 4:4 + len(CLASS_NAMES)]

    class_ids = np.argmax(
        class_scores,
        axis=1
    )

    confidences = np.max(
        class_scores,
        axis=1
    )

    # Confidence filter
    mask = confidences >= CONFIDENCE_THRESHOLD

    boxes_xywh = boxes_xywh[mask]
    confidences = confidences[mask]
    class_ids = class_ids[mask]

    if len(boxes_xywh) == 0:
        return [], inference_time_ms

    # Convert xywh -> xyxy
    cx = boxes_xywh[:, 0]
    cy = boxes_xywh[:, 1]
    width = boxes_xywh[:, 2]
    height = boxes_xywh[:, 3]

    x1 = cx - width / 2
    y1 = cy - height / 2
    x2 = cx + width / 2
    y2 = cy + height / 2

    boxes = np.column_stack(
        [x1, y1, x2, y2]
    )

    # Remove letterbox padding
    boxes[:, [0, 2]] -= pad_x
    boxes[:, [1, 3]] -= pad_y

    # Convert back to original image coordinates
    boxes[:, [0, 2]] /= scale
    boxes[:, [1, 3]] /= scale

    # Clip to original image
    boxes[:, [0, 2]] = np.clip(
        boxes[:, [0, 2]],
        0,
        original_width
    )

    boxes[:, [1, 3]] = np.clip(
        boxes[:, [1, 3]],
        0,
        original_height
    )

    # NMS
    keep_indices = non_max_suppression(
        boxes,
        confidences,
        class_ids,
        iou_threshold=NMS_IOU_THRESHOLD,
        max_detections=MAX_DETECTIONS,
    )

    detections = []

    for index in keep_indices:

        x1, y1, x2, y2 = boxes[index]

        confidence = float(
            confidences[index]
        )

        class_id = int(
            class_ids[index]
        )

        detections.append({
            "bbox": [
                float(x1),
                float(y1),
                float(x2),
                float(y2),
            ],
            "confidence": confidence,
            "class_id": class_id,
        })

    return detections, inference_time_ms


# ============================================================
# ANNOTATED IMAGE
# ============================================================

def create_annotated_image(
    image: Image.Image,
    detections: list,
):
    """
    Draw bounding boxes without OpenCV.
    """

    annotated = image.copy().convert("RGB")

    draw = ImageDraw.Draw(annotated)

    try:
        font = ImageFont.load_default()
    except Exception:
        font = None

    for detection in detections:

        x1, y1, x2, y2 = detection["bbox"]

        confidence = detection["confidence"]
        class_id = detection["class_id"]

        class_name = CLASS_NAMES.get(
            class_id,
            "Unknown Anomaly"
        )

        label = (
            f"{class_name} "
            f"{confidence * 100:.1f}%"
        )

        # Bounding box
        draw.rectangle(
            [
                x1,
                y1,
                x2,
                y2,
            ],
            outline=(255, 0, 0),
            width=3,
        )

        # Label background
        try:
            bbox = draw.textbbox(
                (x1, y1),
                label,
                font=font
            )

            text_width = bbox[2] - bbox[0]
            text_height = bbox[3] - bbox[1]

        except Exception:
            text_width = len(label) * 7
            text_height = 12

        label_y = max(
            0,
            y1 - text_height - 4
        )

        draw.rectangle(
            [
                x1,
                label_y,
                x1 + text_width + 6,
                label_y + text_height + 4,
            ],
            fill=(255, 0, 0),
        )

        draw.text(
            (
                x1 + 3,
                label_y + 2,
            ),
            label,
            fill=(255, 255, 255),
            font=font,
        )

    return annotated


# ============================================================
# PROCESS IMAGE
# ============================================================

def process_image(
    image_bytes: bytes,
    filename: str
) -> dict:

    scan_id = (
        f"scan-{uuid.uuid4().hex[:8]}"
    )

    image = Image.open(
        io.BytesIO(image_bytes)
    ).convert("RGB")

    width, height = image.size

    file_size_mb = round(
        len(image_bytes) / (1024 * 1024),
        2
    )

    # --------------------------------------------------------
    # ONNX INFERENCE
    # --------------------------------------------------------

    raw_detections, processing_time_ms = (
        run_onnx_inference(image)
    )

    # --------------------------------------------------------
    # INTELLIGENCE ENGINE
    # --------------------------------------------------------

    detections = []

    for raw in raw_detections:

        x1, y1, x2, y2 = raw["bbox"]

        confidence = raw["confidence"]

        class_id = raw["class_id"]

        class_name = CLASS_NAMES.get(
            class_id,
            "Unknown Anomaly"
        )

        intel = get_intelligence(
            class_name,
            confidence,
            [
                x1,
                y1,
                x2,
                y2,
            ]
        )

        detections.append({
            "id": (
                f"det-{uuid.uuid4().hex[:6]}"
            ),
            "className": class_name,
            "category": intel["category"],
            "confidence": round(
                confidence,
                2
            ),
            "bbox": [
                round(x1, 2),
                round(y1, 2),
                round(x2, 2),
                round(y2, 2),
            ],
            "pixelDimensions": intel[
                "pixel_dimensions"
            ],
            "priorityScore": intel[
                "priority_score"
            ],
            "priorityLevel": intel[
                "priority_level"
            ],
            "ecoImpact": intel[
                "eco_impact"
            ],
            "actionRecommended": intel[
                "action_recommended"
            ],
            "verificationStatus": "unreviewed",
            "timestamp": datetime.utcnow().isoformat(),
        })


    # --------------------------------------------------------
    # ANNOTATED IMAGE
    # --------------------------------------------------------

    annotated_pil = create_annotated_image(
        image,
        raw_detections
    )

    orig_path = os.path.join(
        OUTPUTS_DIR,
        f"{scan_id}.jpg"
    )

    annotated_path = os.path.join(
        OUTPUTS_DIR,
        f"{scan_id}_annotated.jpg"
    )

    image.save(
        orig_path,
        format="JPEG",
        quality=90
    )

    annotated_pil.save(
        annotated_path,
        format="JPEG",
        quality=90
    )

    image_url = (
        f"{BACKEND_PUBLIC_URL}/outputs/"
        f"{scan_id}.jpg"
    )

    annotated_image_url = (
        f"{BACKEND_PUBLIC_URL}/outputs/"
        f"{scan_id}_annotated.jpg"
    )


    # --------------------------------------------------------
    # BASE64 IMAGES
    # --------------------------------------------------------

    buffer = io.BytesIO()

    annotated_pil.save(
        buffer,
        format="JPEG",
        quality=85
    )

    annotated_base64 = (
        "data:image/jpeg;base64,"
        + base64.b64encode(
            buffer.getvalue()
        ).decode("utf-8")
    )

    orig_buffer = io.BytesIO()

    image.save(
        orig_buffer,
        format="JPEG",
        quality=80
    )

    orig_base64 = (
        "data:image/jpeg;base64,"
        + base64.b64encode(
            orig_buffer.getvalue()
        ).decode("utf-8")
    )


    # --------------------------------------------------------
    # SONAR QUALITY ANALYSIS
    # --------------------------------------------------------

    try:

        quality_analysis = (
            analyze_sonar_image_quality(
                image_bytes,
                detections=detections
            )
        )

        final_detections = (
            quality_analysis.get(
                "enriched_detections",
                detections
            )
        )

        sq = quality_analysis[
            "sonar_quality"
        ]

        ea = quality_analysis[
            "evidence_assessment"
        ]

        # Frontend-compatible fields
        for det in final_detections:

            if "acoustic_shadow" in det:

                det["shadowMetrics"] = {
                    "shadowDetected":
                        det["acoustic_shadow"].get(
                            "shadow_detected",
                            False
                        ),

                    "shadowContrastRatio":
                        det["acoustic_shadow"].get(
                            "shadow_contrast_ratio",
                            1.0
                        ),

                    "evidenceStrength":
                        det["acoustic_shadow"].get(
                            "evidence_strength",
                            "ABSENT"
                        ),

                    "description":
                        det["acoustic_shadow"].get(
                            "description",
                            ""
                        ),
                }

            det["evidenceScore"] = det.get(
                "evidence_score",
                ea["evidence_score"]
            )

            det["reliability"] = det.get(
                "reliability",
                ea["reliability"]
            )

            det["reviewRequired"] = det.get(
                "review_required",
                ea["review_required"]
            )

            det["reviewReasons"] = det.get(
                "review_reasons",
                ea["review_reasons"]
            )


        sonar_quality_payload = {
            "speckleNoise": {
                "speckleIndex":
                    sq["speckle_noise"][
                        "speckle_index"
                    ],

                "speckleLevel":
                    sq["speckle_noise"][
                        "speckle_level"
                    ],

                "enl":
                    sq["speckle_noise"]["enl"],

                "score":
                    sq["speckle_noise"]["score"],

                "description":
                    sq["speckle_noise"][
                        "description"
                    ],
            },

            "resolutionQuality": {
                "width":
                    sq["resolution_quality"][
                        "width"
                    ],

                "height":
                    sq["resolution_quality"][
                        "height"
                    ],

                "sharpnessScore":
                    sq["resolution_quality"][
                        "sharpness_score"
                    ],

                "laplacianVariance":
                    sq["resolution_quality"][
                        "laplacian_variance"
                    ],

                "meanGradient":
                    sq["resolution_quality"][
                        "mean_gradient"
                    ],

                "contrastScore":
                    sq["resolution_quality"][
                        "contrast_score"
                    ],

                "dynamicRange":
                    sq["resolution_quality"][
                        "dynamic_range"
                    ],

                "qualityRating":
                    sq["resolution_quality"][
                        "quality_rating"
                    ],

                "compositeScore":
                    sq["overall_quality"][
                        "composite_score"
                    ],

                "description":
                    sq["overall_quality"][
                        "description"
                    ],

                "disclaimer":
                    sq["resolution_quality"][
                        "disclaimer"
                    ],
            },

            "acousticShadow": {
                "shadowDetected":
                    sq["acoustic_shadow"][
                        "shadow_detected"
                    ],

                "shadowContrastRatio":
                    sq["acoustic_shadow"][
                        "shadow_contrast_ratio"
                    ],

                "evidenceStrength":
                    sq["acoustic_shadow"][
                        "evidence_strength"
                    ],

                "description":
                    sq["acoustic_shadow"][
                        "description"
                    ],

                "methodology":
                    sq["acoustic_shadow"][
                        "methodology"
                    ],
            },

            "motionDropout": {
                "dropoutDetected":
                    sq["dropout_artifact"][
                        "dropout_detected"
                    ],

                "dropoutCount":
                    sq["dropout_artifact"][
                        "dropout_count"
                    ],

                "dropoutPercentage":
                    sq["dropout_artifact"][
                        "dropout_percentage"
                    ],

                "artifactSeverity":
                    sq["dropout_artifact"][
                        "artifact_severity"
                    ],

                "rowJitterMean":
                    sq["dropout_artifact"][
                        "row_jitter_mean"
                    ],

                "detectedArtifacts":
                    sq["dropout_artifact"][
                        "detected_artifacts"
                    ],

                "description":
                    sq["dropout_artifact"][
                        "description"
                    ],

                "disclaimer":
                    sq["dropout_artifact"][
                        "disclaimer"
                    ],
            },
        }


        evidence_assessment_payload = {
            "evidenceScore":
                ea["evidence_score"],

            "reliability":
                ea["reliability"],

            "reviewRequired":
                ea["review_required"],

            "reviewReasons":
                ea["review_reasons"],

            "components":
                ea["components"],
        }

    except Exception as q_err:

        print(
            f"Warning: Sonar quality analysis failed: "
            f"{q_err}"
        )

        final_detections = detections
        sonar_quality_payload = None
        evidence_assessment_payload = None
        sq = None
        ea = None


    # --------------------------------------------------------
    # SCAN DATA
    # --------------------------------------------------------

    scan_data = {
        "id": scan_id,

        "filename": filename,

        "fileSizeMB": (
            file_size_mb
            if file_size_mb > 0
            else 0.01
        ),

        "resolution": {
            "width": width,
            "height": height,
        },

        "imageUrl": image_url,

        "annotatedImageUrl":
            annotated_image_url,

        "imageBase64":
            orig_base64,

        "annotatedBase64":
            annotated_base64,

        "detections":
            final_detections,

        "detection_count":
            len(final_detections),

        "sonarQuality":
            sonar_quality_payload,

        "sonar_quality":
            sq,

        "evidenceAssessment":
            evidence_assessment_payload,

        "evidence_assessment":
            ea,

        "processedAt":
            datetime.utcnow().strftime(
                "%Y-%m-%d %H:%M:%S UTC"
            ),

        "processingTimeMs":
            max(
                1,
                processing_time_ms
            ),

        "modelVersion":
            "YOLO11n ONNX (best.onnx)",

        "isSample":
            False,

        "success":
            True,
    }


    # --------------------------------------------------------
    # SAVE TO DATABASE
    # --------------------------------------------------------

    try:

        database.save_scan(
            {
                "id":
                    scan_id,

                "filename":
                    filename,

                "file_size_mb":
                    file_size_mb,

                "resolution":
                    {
                        "width": width,
                        "height": height,
                    },

                "image_url":
                    image_url,

                "annotated_image_url":
                    annotated_image_url,

                "processed_at":
                    scan_data["processedAt"],

                "processing_time_ms":
                    scan_data["processingTimeMs"],

                "model_version":
                    scan_data["modelVersion"],

                "sonarQuality":
                    scan_data.get(
                        "sonarQuality"
                    ),

                "evidenceAssessment":
                    scan_data.get(
                        "evidenceAssessment"
                    ),
            },
            final_detections
        )

    except Exception as e:

        print(
            f"Error saving to database: {e}"
        )


    return scan_data


# ============================================================
# SINGLE IMAGE
# ============================================================

@app.post("/predict")
async def predict_single(
    file: UploadFile = File(...)
):

    contents = await file.read()

    return process_image(
        contents,
        file.filename
    )


# ============================================================
# BATCH IMAGE
# ============================================================

@app.post("/predict-batch")
async def predict_batch(
    files: list[UploadFile] = File(...)
):

    scans = []

    for file in files:

        contents = await file.read()

        scan = process_image(
            contents,
            file.filename
        )

        scans.append(scan)

    return scans


# ============================================================
# GET SCANS
# ============================================================

@app.get("/scans")
def get_scans(
    limit: int = 200
):

    return {
        "scans":
            database.get_all_scans(
                limit=limit
            )
    }


# ============================================================
# DELETE SINGLE SCAN
# ============================================================

@app.delete("/scans/{scan_id}")
def delete_single_scan(
    scan_id: str
):

    database.delete_scan(
        scan_id
    )

    return {
        "status": "SUCCESS",
        "message":
            f"Scan {scan_id} deleted successfully."
    }


# ============================================================
# DELETE ALL SCANS
# ============================================================

@app.delete("/scans")
def clear_all_history():

    database.clear_all_scans()

    return {
        "status": "SUCCESS",
        "message":
            "All scan history cleared successfully."
    }


# ============================================================
# FEEDBACK
# ============================================================

@app.post("/feedback")
async def record_feedback(
    scan_id: str = Form(...),
    detection_id: str = Form(...),
    status: str = Form(...),
    notes: str = Form("")
):

    feedback_id = (
        f"hitl-{uuid.uuid4().hex[:8]}"
    )

    feedback = {
        "id":
            feedback_id,

        "scan_id":
            scan_id,

        "detection_id":
            detection_id,

        "original_class":
            "Classified Target",

        "verified_class":
            "Classified Target",

        "confidence":
            0.85,

        "status":
            status,

        "notes":
            notes,

        "operator_role":
            "Hydrographic Operator",

        "timestamp":
            datetime.utcnow().isoformat(),
    }

    database.record_hitl_feedback(
        feedback
    )

    return {
        "status":
            "SUCCESS",

        "feedback_id":
            feedback_id,
    }


# ============================================================
# LOCAL RUN
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=int(
            os.getenv(
                "PORT",
                "8000"
            )
        )
    )
