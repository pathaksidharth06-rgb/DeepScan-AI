"""
DeepScan AI - FastAPI Backend
ONNX Runtime version

Uses:
    backend/best.onnx

The API remains compatible with the existing frontend.
"""

import os
import uuid
import base64
import io
import time
import gc
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
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="DeepScan AI - Underwater Sonar Intelligence API",
    version="2.1.0",
    description=(
        "AI-powered Side-Scan Sonar Intelligence "
        "and Mission Analysis API using ONNX Runtime."
    )
)


# ============================================================
# CORS
# ============================================================

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

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

OUTPUTS_DIR = os.path.join(
    BASE_DIR,
    "outputs"
)

os.makedirs(
    OUTPUTS_DIR,
    exist_ok=True
)

app.mount(
    "/outputs",
    StaticFiles(directory=OUTPUTS_DIR),
    name="outputs"
)


# ============================================================
# BACKEND PUBLIC URL
# ============================================================

BACKEND_PUBLIC_URL = os.getenv(
    "BACKEND_PUBLIC_URL",
    "https://deepscan-ai-tyvx.onrender.com"
).rstrip("/")


# ============================================================
# MODEL
# ============================================================

MODEL_PATH = os.path.join(
    BASE_DIR,
    "best.onnx"
)


# ============================================================
# MODEL CLASSES
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
# INFERENCE SETTINGS
# ============================================================

CONFIDENCE_THRESHOLD = 0.20
IOU_THRESHOLD = 0.45
MAX_DETECTIONS = 10


# ============================================================
# LOAD ONNX MODEL
# ============================================================

print("==============================================")
print("          DEEPSCAN AI BACKEND")
print("==============================================")

print("Loading ONNX model...")
print("Model path:")
print(MODEL_PATH)


if not os.path.exists(MODEL_PATH):

    raise FileNotFoundError(
        f"ONNX model not found: {MODEL_PATH}"
    )


session = ort.InferenceSession(
    MODEL_PATH,
    providers=["CPUExecutionProvider"]
)


INPUT_NAME = session.get_inputs()[0].name

INPUT_SHAPE = session.get_inputs()[0].shape


try:

    INPUT_HEIGHT = int(
        INPUT_SHAPE[2]
    )

    INPUT_WIDTH = int(
        INPUT_SHAPE[3]
    )

except Exception:

    INPUT_HEIGHT = 256
    INPUT_WIDTH = 256


print(
    "ONNX model loaded successfully!"
)

print(
    f"Input size: "
    f"{INPUT_WIDTH}x{INPUT_HEIGHT}"
)

print(
    f"Classes: {CLASS_NAMES}"
)

print("==============================================")


# ============================================================
# DATABASE STARTUP
# ============================================================

@app.on_event("startup")
def startup():

    database.init_db()


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def home():

    return {
        "message":
            "DeepScan AI Backend is running",

        "status":
            "online",

        "model":
            "best.onnx",

        "runtime":
            "ONNX Runtime",

        "classes":
            CLASS_NAMES,

        "number_of_classes":
            len(CLASS_NAMES),

        "natural_view":
            False,

        "intelligence_engine":
            True,

        "human_in_the_loop":
            True,

        "database":
            "SQLite",

        "batch_mission":
            True
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health_check():

    return {

        "status":
            "ONLINE",

        "model":
            "YOLO11n (best.onnx)",

        "runtime":
            "ONNX Runtime CPU",

        "classes":
            CLASS_NAMES,

        "taxonomy_classes":
            len(CLASS_NAMES),

        "model_file_present":
            os.path.exists(MODEL_PATH),

        "sonar_quality_analyzer":
            "ACTIVE",

        "quality_modules": [

            "speckle_noise",

            "resolution_quality",

            "acoustic_shadow",

            "motion_dropout",

            "evidence_score"
        ],

        "input_size": {

            "width":
                INPUT_WIDTH,

            "height":
                INPUT_HEIGHT
        }
    }


# ============================================================
# MODEL INFO
# ============================================================

@app.get("/model-info")
def model_info():

    return {

        "model":
            "best.onnx",

        "runtime":
            "ONNX Runtime",

        "classes":
            CLASS_NAMES,

        "number_of_classes":
            len(CLASS_NAMES),

        "natural_view":
            False,

        "intelligence_engine":
            True,

        "human_in_the_loop":
            True,

        "database":
            "SQLite",

        "batch_mission":
            True
    }


# ============================================================
# LETTERBOX
# ============================================================

def preprocess_image(image):

    original_width, original_height = (
        image.size
    )

    scale = min(

        INPUT_WIDTH /
        original_width,

        INPUT_HEIGHT /
        original_height
    )

    new_width = max(
        1,
        int(
            round(
                original_width * scale
            )
        )
    )

    new_height = max(
        1,
        int(
            round(
                original_height * scale
            )
        )
    )

    resized = image.resize(
        (
            new_width,
            new_height
        ),
        Image.Resampling.BILINEAR
    )

    canvas = Image.new(
        "RGB",
        (
            INPUT_WIDTH,
            INPUT_HEIGHT
        ),
        (114, 114, 114)
    )

    pad_x = (
        INPUT_WIDTH -
        new_width
    ) // 2

    pad_y = (
        INPUT_HEIGHT -
        new_height
    ) // 2

    canvas.paste(
        resized,
        (
            pad_x,
            pad_y
        )
    )

    array = np.asarray(
        canvas,
        dtype=np.float32
    )

    array = array.transpose(
        2,
        0,
        1
    )

    array /= 255.0

    array = np.expand_dims(
        array,
        axis=0
    )

    return (
        array,
        scale,
        pad_x,
        pad_y,
        original_width,
        original_height
    )


# ============================================================
# IOU
# ============================================================

def calculate_iou(
    box1,
    box2
):

    x1 = max(
        box1[0],
        box2[0]
    )

    y1 = max(
        box1[1],
        box2[1]
    )

    x2 = min(
        box1[2],
        box2[2]
    )

    y2 = min(
        box1[3],
        box2[3]
    )

    intersection_width = max(
        0.0,
        x2 - x1
    )

    intersection_height = max(
        0.0,
        y2 - y1
    )

    intersection = (
        intersection_width *
        intersection_height
    )

    area1 = (
        max(
            0.0,
            box1[2] - box1[0]
        )
        *
        max(
            0.0,
            box1[3] - box1[1]
        )
    )

    area2 = (
        max(
            0.0,
            box2[2] - box2[0]
        )
        *
        max(
            0.0,
            box2[3] - box2[1]
        )
    )

    union = (
        area1 +
        area2 -
        intersection
    )

    if union <= 0:

        return 0.0

    return (
        intersection /
        union
    )


# ============================================================
# NMS
# ============================================================

def non_max_suppression(
    boxes,
    scores,
    class_ids
):

    if len(boxes) == 0:

        return []


    boxes = np.asarray(
        boxes,
        dtype=np.float32
    )

    scores = np.asarray(
        scores,
        dtype=np.float32
    )

    class_ids = np.asarray(
        class_ids,
        dtype=np.int32
    )

    keep = []


    for class_id in np.unique(
        class_ids
    ):

        indices = np.where(
            class_ids ==
            class_id
        )[0]

        indices = indices[
            np.argsort(
                scores[indices]
            )[::-1]
        ]


        while len(indices) > 0:

            current = indices[0]

            keep.append(
                int(current)
            )

            if len(keep) >= MAX_DETECTIONS:

                break


            remaining = []

            for index in indices[1:]:

                iou = calculate_iou(
                    boxes[current],
                    boxes[index]
                )

                if iou < IOU_THRESHOLD:

                    remaining.append(
                        index
                    )

            indices = np.asarray(
                remaining,
                dtype=np.int32
            )


        if len(keep) >= MAX_DETECTIONS:

            break


    keep.sort(
        key=lambda x:
            float(scores[x]),
        reverse=True
    )

    return keep[
        :MAX_DETECTIONS
    ]


# ============================================================
# ONNX INFERENCE
# ============================================================

def run_inference(image):

    (
        input_tensor,
        scale,
        pad_x,
        pad_y,
        original_width,
        original_height
    ) = preprocess_image(
        image
    )


    start_time = time.perf_counter()


    outputs = session.run(
        None,
        {
            INPUT_NAME:
                input_tensor
        }
    )


    processing_time_ms = int(

        (
            time.perf_counter()
            -
            start_time
        )
        *
        1000
    )


    if not outputs:

        return (
            [],
            processing_time_ms
        )


    output = np.asarray(
        outputs[0]
    )


    if output.ndim == 3:

        output = output[0]


    # YOLO ONNX normally returns:
    # [1, 4 + classes, predictions]
    #
    # Convert to:
    # [predictions, 4 + classes]

    if output.shape[0] < output.shape[1]:

        output = output.transpose(
            1,
            0
        )


    expected_channels = (
        4 +
        len(CLASS_NAMES)
    )


    if output.shape[1] < expected_channels:

        raise RuntimeError(
            "Unexpected ONNX output shape: "
            f"{output.shape}"
        )


    boxes_xywh = output[
        :,
        :4
    ]


    class_scores = output[
        :,
        4:
        4 + len(CLASS_NAMES)
    ]


    class_ids = np.argmax(
        class_scores,
        axis=1
    )


    confidences = np.max(
        class_scores,
        axis=1
    )


    mask = (
        confidences >=
        CONFIDENCE_THRESHOLD
    )


    boxes_xywh = boxes_xywh[
        mask
    ]

    confidences = confidences[
        mask
    ]

    class_ids = class_ids[
        mask
    ]


    if len(boxes_xywh) == 0:

        return (
            [],
            processing_time_ms
        )


    # --------------------------------------------------------
    # XYWH -> XYXY
    # --------------------------------------------------------

    cx = boxes_xywh[:, 0]

    cy = boxes_xywh[:, 1]

    width = boxes_xywh[:, 2]

    height = boxes_xywh[:, 3]


    x1 = (
        cx -
        width / 2
    )

    y1 = (
        cy -
        height / 2
    )

    x2 = (
        cx +
        width / 2
    )

    y2 = (
        cy +
        height / 2
    )


    boxes = np.column_stack(
        [
            x1,
            y1,
            x2,
            y2
        ]
    )


    # --------------------------------------------------------
    # Remove padding
    # --------------------------------------------------------

    boxes[:, [0, 2]] -= pad_x

    boxes[:, [1, 3]] -= pad_y


    # --------------------------------------------------------
    # Scale to original image
    # --------------------------------------------------------

    boxes[:, [0, 2]] /= scale

    boxes[:, [1, 3]] /= scale


    # --------------------------------------------------------
    # Clip boxes
    # --------------------------------------------------------

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


    # --------------------------------------------------------
    # NMS
    # --------------------------------------------------------

    keep = non_max_suppression(
        boxes,
        confidences,
        class_ids
    )


    detections = []


    for index in keep:

        x1, y1, x2, y2 = (
            boxes[index]
        )

        detections.append({

            "class_id":
                int(
                    class_ids[index]
                ),

            "confidence":
                float(
                    confidences[index]
                ),

            "bbox": [

                float(x1),

                float(y1),

                float(x2),

                float(y2)
            ]
        })


    # Free temporary arrays
    del output
    del outputs
    del input_tensor

    gc.collect()


    return (
        detections,
        processing_time_ms
    )


# ============================================================
# ANNOTATED IMAGE
# ============================================================

def create_annotated_image(
    image,
    detections
):

    annotated = image.copy().convert(
        "RGB"
    )

    draw = ImageDraw.Draw(
        annotated
    )

    try:

        font = ImageFont.load_default()

    except Exception:

        font = None


    for detection in detections:

        x1, y1, x2, y2 = (
            detection["bbox"]
        )

        class_id = (
            detection["class_id"]
        )

        confidence = (
            detection["confidence"]
        )

        class_name = CLASS_NAMES.get(
            class_id,
            "Unknown Anomaly"
        )


        label = (
            f"{class_name} "
            f"{confidence * 100:.1f}%"
        )


        draw.rectangle(
            [
                x1,
                y1,
                x2,
                y2
            ],
            outline=(255, 0, 0),
            width=3
        )


        try:

            text_box = draw.textbbox(
                (
                    x1,
                    y1
                ),
                label,
                font=font
            )

            text_width = (
                text_box[2]
                -
                text_box[0]
            )

            text_height = (
                text_box[3]
                -
                text_box[1]
            )

        except Exception:

            text_width = (
                len(label) *
                7
            )

            text_height = 12


        label_y = max(
            0,
            y1 -
            text_height -
            4
        )


        draw.rectangle(
            [
                x1,
                label_y,
                x1 +
                text_width +
                6,
                label_y +
                text_height +
                4
            ],
            fill=(255, 0, 0)
        )


        draw.text(
            (
                x1 + 3,
                label_y + 2
            ),
            label,
            fill=(255, 255, 255),
            font=font
        )


    return annotated


# ============================================================
# PROCESS IMAGE
# ============================================================

def process_image(
    image_bytes: bytes,
    filename: str
):

    scan_id = (
        f"scan-{uuid.uuid4().hex[:8]}"
    )


    # --------------------------------------------------------
    # Open image
    # --------------------------------------------------------

    image = Image.open(
        io.BytesIO(
            image_bytes
        )
    ).convert("RGB")


    width, height = (
        image.size
    )


    file_size_mb = round(
        len(image_bytes)
        /
        (
            1024 * 1024
        ),
        2
    )


    # --------------------------------------------------------
    # ONNX DETECTION
    # --------------------------------------------------------

    raw_detections, processing_time_ms = (
        run_inference(
            image
        )
    )


    # --------------------------------------------------------
    # INTELLIGENCE
    # --------------------------------------------------------

    detections = []


    for detection in raw_detections:

        class_id = (
            detection["class_id"]
        )

        confidence = (
            detection["confidence"]
        )

        x1, y1, x2, y2 = (
            detection["bbox"]
        )


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
                y2
            ]
        )


        detections.append({

            "id":
                f"det-{uuid.uuid4().hex[:6]}",

            "className":
                class_name,

            "category":
                intel["category"],

            "confidence":
                round(
                    confidence,
                    2
                ),

            "bbox": [

                round(x1, 2),

                round(y1, 2),

                round(x2, 2),

                round(y2, 2)
            ],

            "pixelDimensions":
                intel[
                    "pixel_dimensions"
                ],

            "priorityScore":
                intel[
                    "priority_score"
                ],

            "priorityLevel":
                intel[
                    "priority_level"
                ],

            "ecoImpact":
                intel[
                    "eco_impact"
                ],

            "actionRecommended":
                intel[
                    "action_recommended"
                ],

            "verificationStatus":
                "unreviewed",

            "timestamp":
                datetime.utcnow().isoformat()
        })


    # --------------------------------------------------------
    # ANNOTATION
    # --------------------------------------------------------

    annotated_pil = (
        create_annotated_image(
            image,
            raw_detections
        )
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
        quality=88
    )


    annotated_pil.save(
        annotated_path,
        format="JPEG",
        quality=88
    )


    image_url = (
        f"{BACKEND_PUBLIC_URL}"
        f"/outputs/{scan_id}.jpg"
    )


    annotated_image_url = (
        f"{BACKEND_PUBLIC_URL}"
        f"/outputs/"
        f"{scan_id}_annotated.jpg"
    )


    # --------------------------------------------------------
    # BASE64
    # --------------------------------------------------------

    buffer = io.BytesIO()


    annotated_pil.save(
        buffer,
        format="JPEG",
        quality=82
    )


    annotated_base64 = (
        "data:image/jpeg;base64,"
        +
        base64.b64encode(
            buffer.getvalue()
        ).decode(
            "utf-8"
        )
    )


    orig_buffer = io.BytesIO()


    image.save(
        orig_buffer,
        format="JPEG",
        quality=78
    )


    orig_base64 = (
        "data:image/jpeg;base64,"
        +
        base64.b64encode(
            orig_buffer.getvalue()
        ).decode(
            "utf-8"
        )
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


        for det in final_detections:

            if "acoustic_shadow" in det:

                shadow = (
                    det[
                        "acoustic_shadow"
                    ]
                )


                det[
                    "shadowMetrics"
                ] = {

                    "shadowDetected":
                        shadow.get(
                            "shadow_detected",
                            False
                        ),

                    "shadowContrastRatio":
                        shadow.get(
                            "shadow_contrast_ratio",
                            1.0
                        ),

                    "evidenceStrength":
                        shadow.get(
                            "evidence_strength",
                            "ABSENT"
                        ),

                    "description":
                        shadow.get(
                            "description",
                            ""
                        )
                }


            det[
                "evidenceScore"
            ] = det.get(
                "evidence_score",
                ea["evidence_score"]
            )


            det[
                "reliability"
            ] = det.get(
                "reliability",
                ea["reliability"]
            )


            det[
                "reviewRequired"
            ] = det.get(
                "review_required",
                ea["review_required"]
            )


            det[
                "reviewReasons"
            ] = det.get(
                "review_reasons",
                ea["review_reasons"]
            )


        sonar_quality_payload = {

            "speckleNoise": {

                "speckleIndex":
                    sq[
                        "speckle_noise"
                    ][
                        "speckle_index"
                    ],

                "speckleLevel":
                    sq[
                        "speckle_noise"
                    ][
                        "speckle_level"
                    ],

                "enl":
                    sq[
                        "speckle_noise"
                    ][
                        "enl"
                    ],

                "score":
                    sq[
                        "speckle_noise"
                    ][
                        "score"
                    ],

                "description":
                    sq[
                        "speckle_noise"
                    ][
                        "description"
                    ]
            },


            "resolutionQuality": {

                "width":
                    sq[
                        "resolution_quality"
                    ][
                        "width"
                    ],

                "height":
                    sq[
                        "resolution_quality"
                    ][
                        "height"
                    ],

                "sharpnessScore":
                    sq[
                        "resolution_quality"
                    ][
                        "sharpness_score"
                    ],

                "laplacianVariance":
                    sq[
                        "resolution_quality"
                    ][
                        "laplacian_variance"
                    ],

                "meanGradient":
                    sq[
                        "resolution_quality"
                    ][
                        "mean_gradient"
                    ],

                "contrastScore":
                    sq[
                        "resolution_quality"
                    ][
                        "contrast_score"
                    ],

                "dynamicRange":
                    sq[
                        "resolution_quality"
                    ][
                        "dynamic_range"
                    ],

                "qualityRating":
                    sq[
                        "resolution_quality"
                    ][
                        "quality_rating"
                    ],

                "compositeScore":
                    sq[
                        "overall_quality"
                    ][
                        "composite_score"
                    ],

                "description":
                    sq[
                        "overall_quality"
                    ][
                        "description"
                    ],

                "disclaimer":
                    sq[
                        "resolution_quality"
                    ][
                        "disclaimer"
                    ]
            },


            "acousticShadow": {

                "shadowDetected":
                    sq[
                        "acoustic_shadow"
                    ][
                        "shadow_detected"
                    ],

                "shadowContrastRatio":
                    sq[
                        "acoustic_shadow"
                    ][
                        "shadow_contrast_ratio"
                    ],

                "evidenceStrength":
                    sq[
                        "acoustic_shadow"
                    ][
                        "evidence_strength"
                    ],

                "description":
                    sq[
                        "acoustic_shadow"
                    ][
                        "description"
                    ],

                "methodology":
                    sq[
                        "acoustic_shadow"
                    ][
                        "methodology"
                    ]
            },


            "motionDropout": {

                "dropoutDetected":
                    sq[
                        "dropout_artifact"
                    ][
                        "dropout_detected"
                    ],

                "dropoutCount":
                    sq[
                        "dropout_artifact"
                    ][
                        "dropout_count"
                    ],

                "dropoutPercentage":
                    sq[
                        "dropout_artifact"
                    ][
                        "dropout_percentage"
                    ],

                "artifactSeverity":
                    sq[
                        "dropout_artifact"
                    ][
                        "artifact_severity"
                    ],

                "rowJitterMean":
                    sq[
                        "dropout_artifact"
                    ][
                        "row_jitter_mean"
                    ],

                "detectedArtifacts":
                    sq[
                        "dropout_artifact"
                    ][
                        "detected_artifacts"
                    ],

                "description":
                    sq[
                        "dropout_artifact"
                    ][
                        "description"
                    ],

                "disclaimer":
                    sq[
                        "dropout_artifact"
                    ][
                        "disclaimer"
                    ]
            }
        }


        evidence_assessment_payload = {

            "evidenceScore":
                ea[
                    "evidence_score"
                ],

            "reliability":
                ea[
                    "reliability"
                ],

            "reviewRequired":
                ea[
                    "review_required"
                ],

            "reviewReasons":
                ea[
                    "review_reasons"
                ],

            "components":
                ea[
                    "components"
                ]
        }


    except Exception as error:

        print(
            "Sonar quality analysis "
            f"failed: {error}"
        )


        final_detections = detections

        sonar_quality_payload = None

        evidence_assessment_payload = None

        sq = None

        ea = None


    # --------------------------------------------------------
    # SCAN RESPONSE
    # --------------------------------------------------------

    scan_data = {

        "id":
            scan_id,

        "filename":
            filename,

        "fileSizeMB":
            file_size_mb or 0.01,

        "resolution": {

            "width":
                width,

            "height":
                height
        },

        "imageUrl":
            image_url,

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
            "YOLO11n (best.onnx)",

        "isSample":
            False,

        "success":
            True
    }


    # --------------------------------------------------------
    # DATABASE
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
                        "width":
                            width,

                        "height":
                            height
                    },

                "image_url":
                    image_url,

                "annotated_image_url":
                    annotated_image_url,

                "processed_at":
                    scan_data[
                        "processedAt"
                    ],

                "processing_time_ms":
                    scan_data[
                        "processingTimeMs"
                    ],

                "model_version":
                    scan_data[
                        "modelVersion"
                    ],

                "sonarQuality":
                    scan_data.get(
                        "sonarQuality"
                    ),

                "evidenceAssessment":
                    scan_data.get(
                        "evidenceAssessment"
                    )
            },

            final_detections
        )

    except Exception as error:

        print(
            f"Error saving to database: "
            f"{error}"
        )


    # Free some memory
    gc.collect()


    return scan_data


# ============================================================
# SINGLE PREDICT
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
# BATCH PREDICT
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

        scans.append(
            scan
        )

        gc.collect()


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

        "status":
            "SUCCESS",

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

        "status":
            "SUCCESS",

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
            datetime.utcnow().isoformat()
    }


    database.record_hitl_feedback(
        feedback
    )


    return {

        "status":
            "SUCCESS",

        "feedback_id":
            feedback_id
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
