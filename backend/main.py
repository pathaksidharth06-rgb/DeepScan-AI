import os
import gc
import time
import base64
import uuid
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

from PIL import Image, ImageDraw

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import database
from intelligence import get_intelligence
from sonar_quality import analyze_sonar_image_quality


# ============================================================
# CONFIG
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

MODEL_PATH = BASE_DIR / "best.onnx"

OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BACKEND_PUBLIC_URL = os.getenv(
    "BACKEND_PUBLIC_URL",
    "https://deepscan-ai-tyvx.onrender.com"
).rstrip("/")


# Detection settings
CONFIDENCE_THRESHOLD = 0.20
IOU_THRESHOLD = 0.45
MAX_DETECTIONS = 10


# ============================================================
# CLASS NAMES
# ============================================================

CLASS_NAMES = [
    "Fishing Net",
    "Crab Pot",
    "Shipwreck",
    "Pipe",
    "Rope",
    "Tire",
    "Weight",
    "Block",
    "Artificial Reef",
    "Pipeline/Cylinder",
    "Boulder",
]


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="DeepScan AI API",
    description="Underwater Sonar Object Detection API",
    version="2.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# OUTPUT FILES
# ============================================================

app.mount(
    "/outputs",
    StaticFiles(directory=str(OUTPUT_DIR)),
    name="outputs",
)


# ============================================================
# ONNX VARIABLES
# ============================================================

session = None
input_name = None

input_width = 256
input_height = 256


# ============================================================
# LOAD ONNX MODEL
# ============================================================

def load_model():

    global session
    global input_name
    global input_width
    global input_height

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"ONNX model not found: {MODEL_PATH}"
        )

    session_options = ort.SessionOptions()

    # Low memory / CPU configuration
    session_options.intra_op_num_threads = 1
    session_options.inter_op_num_threads = 1

    session_options.execution_mode = (
        ort.ExecutionMode.ORT_SEQUENTIAL
    )

    session_options.graph_optimization_level = (
        ort.GraphOptimizationLevel.ORT_ENABLE_BASIC
    )

    session = ort.InferenceSession(
        str(MODEL_PATH),
        sess_options=session_options,
        providers=["CPUExecutionProvider"],
    )

    input_info = session.get_inputs()[0]

    input_name = input_info.name

    shape = input_info.shape

    try:

        if isinstance(shape[2], int):
            input_height = shape[2]

        if isinstance(shape[3], int):
            input_width = shape[3]

    except Exception:

        input_width = 256
        input_height = 256

    print("======================================")
    print("DeepScan AI - ONNX Runtime")
    print("Model:", MODEL_PATH.name)
    print(
        "Input:",
        input_width,
        "x",
        input_height
    )
    print(
        "Providers:",
        session.get_providers()
    )
    print("======================================")


# Load model
load_model()


# ============================================================
# DATABASE
# ============================================================

try:
    database.init_db()
except Exception as e:
    print(
        "Database initialization warning:",
        e
    )


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "success": True,
        "message": "DeepScan AI API is running",
        "model": "best.onnx",
        "version": "2.0.0",
    }


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():

    return {
        "status": "healthy",
        "model_loaded": session is not None,
        "model": "best.onnx",
        "runtime": "onnxruntime",
    }


# ============================================================
# MODEL INFO
# ============================================================

@app.get("/model-info")
def model_info():

    return {
        "model": "best.onnx",
        "modelVersion": "YOLO11n-ONNX",
        "classes": CLASS_NAMES,
        "classCount": len(CLASS_NAMES),
        "inputSize": [
            input_width,
            input_height
        ],
        "runtime": "ONNX Runtime",
    }


# ============================================================
# LETTERBOX
# ============================================================

def letterbox(
    image,
    new_width,
    new_height
):

    original_height, original_width = image.shape[:2]

    scale = min(
        new_width / original_width,
        new_height / original_height,
    )

    resized_width = int(
        round(original_width * scale)
    )

    resized_height = int(
        round(original_height * scale)
    )

    resized = cv2.resize(
        image,
        (
            resized_width,
            resized_height
        ),
        interpolation=cv2.INTER_LINEAR,
    )

    canvas = np.full(
        (
            new_height,
            new_width,
            3
        ),
        114,
        dtype=np.uint8,
    )

    pad_x = (
        new_width - resized_width
    ) // 2

    pad_y = (
        new_height - resized_height
    ) // 2

    canvas[
        pad_y:pad_y + resized_height,
        pad_x:pad_x + resized_width
    ] = resized

    return (
        canvas,
        scale,
        pad_x,
        pad_y,
    )


# ============================================================
# PREPROCESS IMAGE
# ============================================================

def preprocess(image_bytes):

    image_array = np.frombuffer(
        image_bytes,
        dtype=np.uint8,
    )

    image = cv2.imdecode(
        image_array,
        cv2.IMREAD_COLOR,
    )

    if image is None:
        raise ValueError(
            "Could not decode image"
        )

    original_height, original_width = (
        image.shape[:2]
    )

    processed, scale, pad_x, pad_y = letterbox(
        image,
        input_width,
        input_height,
    )

    # BGR -> RGB
    processed = cv2.cvtColor(
        processed,
        cv2.COLOR_BGR2RGB,
    )

    # uint8 -> float32
    processed = (
        processed.astype(np.float32)
        / 255.0
    )

    # HWC -> CHW
    processed = np.transpose(
        processed,
        (2, 0, 1),
    )

    # Add batch
    processed = np.expand_dims(
        processed,
        axis=0,
    )

    processed = np.ascontiguousarray(
        processed,
        dtype=np.float32,
    )

    return (
        processed,
        image,
        original_width,
        original_height,
        scale,
        pad_x,
        pad_y,
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
        0,
        x2 - x1
    )

    intersection_height = max(
        0,
        y2 - y1
    )

    intersection = (
        intersection_width
        * intersection_height
    )

    area1 = (
        max(
            0,
            box1[2] - box1[0]
        )
        *
        max(
            0,
            box1[3] - box1[1]
        )
    )

    area2 = (
        max(
            0,
            box2[2] - box2[0]
        )
        *
        max(
            0,
            box2[3] - box2[1]
        )
    )

    union = (
        area1
        + area2
        - intersection
    )

    if union <= 0:
        return 0.0

    return intersection / union


# ============================================================
# NMS
# ============================================================

def nms(
    boxes,
    scores,
    iou_threshold
):

    if len(boxes) == 0:
        return []

    order = np.argsort(
        np.array(scores)
    )[::-1]

    keep = []

    while len(order) > 0:

        current = order[0]

        keep.append(current)

        if len(order) == 1:
            break

        remaining = order[1:]

        new_remaining = []

        for index in remaining:

            iou = calculate_iou(
                boxes[current],
                boxes[index],
            )

            if iou < iou_threshold:
                new_remaining.append(index)

        order = np.array(
            new_remaining,
            dtype=np.int64,
        )

    return keep


# ============================================================
# PARSE YOLO ONNX OUTPUT
# ============================================================

def parse_predictions(
    output,
    original_width,
    original_height,
    scale,
    pad_x,
    pad_y,
):

    predictions = np.asarray(output)

    # Remove batch dimension
    if predictions.ndim == 3:
        predictions = predictions[0]

    if predictions.ndim != 2:

        raise ValueError(
            "Unexpected ONNX output shape: "
            f"{predictions.shape}"
        )

    # YOLO output can be:
    #
    # [84, 8400]
    #
    # or
    #
    # [8400, 84]
    #
    if predictions.shape[0] < predictions.shape[1]:
        predictions = predictions.T

    num_values = predictions.shape[1]

    num_classes = len(CLASS_NAMES)

    expected_values = (
        4 + num_classes
    )

    if num_values < expected_values:

        raise ValueError(
            "Unexpected YOLO output shape: "
            f"{predictions.shape}"
        )

    boxes = []
    scores = []
    class_ids = []

    for row in predictions:

        cx = float(row[0])
        cy = float(row[1])

        width = float(row[2])
        height = float(row[3])

        class_scores = row[
            4:4 + num_classes
        ]

        class_id = int(
            np.argmax(class_scores)
        )

        confidence = float(
            class_scores[class_id]
        )

        if confidence < CONFIDENCE_THRESHOLD:
            continue

        # xywh -> xyxy

        x1 = (
            cx
            - width / 2
        )

        y1 = (
            cy
            - height / 2
        )

        x2 = (
            cx
            + width / 2
        )

        y2 = (
            cy
            + height / 2
        )

        # Remove letterbox padding

        x1 = (
            x1 - pad_x
        ) / scale

        y1 = (
            y1 - pad_y
        ) / scale

        x2 = (
            x2 - pad_x
        ) / scale

        y2 = (
            y2 - pad_y
        ) / scale

        # Clamp

        x1 = max(
            0,
            min(
                x1,
                original_width - 1
            )
        )

        y1 = max(
            0,
            min(
                y1,
                original_height - 1
            )
        )

        x2 = max(
            0,
            min(
                x2,
                original_width - 1
            )
        )

        y2 = max(
            0,
            min(
                y2,
                original_height - 1
            )
        )

        if x2 <= x1 or y2 <= y1:
            continue

        boxes.append([
            x1,
            y1,
            x2,
            y2,
        ])

        scores.append(
            confidence
        )

        class_ids.append(
            class_id
        )

    if not boxes:
        return []

    # Class-wise NMS

    final_indices = []

    unique_classes = set(
        class_ids
    )

    for class_id in unique_classes:

        class_indices = [
            i
            for i, cid in enumerate(class_ids)
            if cid == class_id
        ]

        class_boxes = [
            boxes[i]
            for i in class_indices
        ]

        class_scores = [
            scores[i]
            for i in class_indices
        ]

        kept = nms(
            class_boxes,
            class_scores,
            IOU_THRESHOLD,
        )

        for index in kept:

            final_indices.append(
                class_indices[index]
            )

    # Highest confidence first

    final_indices.sort(
        key=lambda i: scores[i],
        reverse=True,
    )

    final_indices = final_indices[
        :MAX_DETECTIONS
    ]

    detections = []

    for i, index in enumerate(
        final_indices
    ):

        class_id = class_ids[index]

        if (
            class_id < 0
            or class_id >= len(CLASS_NAMES)
        ):
            continue

        x1, y1, x2, y2 = boxes[index]

        detections.append({

            "id": i + 1,

            "className": CLASS_NAMES[
                class_id
            ],

            "classId": class_id,

            "confidence": round(
                scores[index],
                4
            ),

            "bbox": [
                round(x1),
                round(y1),
                round(x2),
                round(y2),
            ],
        })

    return detections


# ============================================================
# DRAW DETECTIONS
# ============================================================

def draw_detections(
    image,
    detections
):

    rgb_image = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2RGB,
    )

    pil_image = Image.fromarray(
        rgb_image
    )

    draw = ImageDraw.Draw(
        pil_image
    )

    for detection in detections:

        x1, y1, x2, y2 = (
            detection["bbox"]
        )

        class_name = (
            detection["className"]
        )

        confidence = (
            detection["confidence"]
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
                y2
            ],
            outline="red",
            width=3,
        )

        # Label background
        try:

            text_box = draw.textbbox(
                (x1, y1),
                label,
            )

            draw.rectangle(
                text_box,
                fill="red",
            )

        except Exception:
            pass

        draw.text(
            (x1, y1),
            label,
            fill="white",
        )

    result = cv2.cvtColor(
        np.array(pil_image),
        cv2.COLOR_RGB2BGR,
    )

    return result


# ============================================================
# IMAGE TO BASE64
# ============================================================

def image_to_base64(image):

    success, encoded = cv2.imencode(
        ".jpg",
        image,
        [
            int(
                cv2.IMWRITE_JPEG_QUALITY
            ),
            85,
        ],
    )

    if not success:
        return None

    return base64.b64encode(
        encoded.tobytes()
    ).decode("utf-8")


# ============================================================
# NORMALIZE INTELLIGENCE DATA
# ============================================================

def add_intelligence_data(
    detection
):

    class_name = detection[
        "className"
    ]

    confidence = detection[
        "confidence"
    ]

    bbox = detection[
        "bbox"
    ]

    try:

        intelligence = get_intelligence(
            class_name,
            confidence,
            bbox,
        )

        if isinstance(
            intelligence,
            dict
        ):

            # Keep original intelligence
            detection.update(
                intelligence
            )

            # ==================================================
            # CONVERT snake_case -> camelCase
            # ==================================================

            detection[
                "priorityScore"
            ] = intelligence.get(
                "priority_score",
                intelligence.get(
                    "priorityScore",
                    0
                )
            )

            detection[
                "priorityLevel"
            ] = intelligence.get(
                "priority_level",
                intelligence.get(
                    "priorityLevel",
                    "LOW"
                )
            )

            detection[
                "ecoImpact"
            ] = intelligence.get(
                "eco_impact",
                intelligence.get(
                    "ecoImpact",
                    "Unknown"
                )
            )

            detection[
                "actionRecommended"
            ] = intelligence.get(
                "action_recommended",
                intelligence.get(
                    "actionRecommended",
                    "Review detection"
                )
            )

            # ==================================================
            # IMPORTANT FRONTEND FIX
            # ==================================================

            pixel_dimensions = (
                intelligence.get(
                    "pixel_dimensions"
                )
            )

            if not pixel_dimensions:

                pixel_dimensions = (
                    intelligence.get(
                        "pixelDimensions"
                    )
                )

            if not pixel_dimensions:

                pixel_dimensions = {
                    "width": abs(
                        bbox[2] - bbox[0]
                    ),
                    "height": abs(
                        bbox[3] - bbox[1]
                    ),
                }

            # Make sure width/height always exist
            detection[
                "pixelDimensions"
            ] = {
                "width": pixel_dimensions.get(
                    "width",
                    abs(
                        bbox[2] - bbox[0]
                    )
                ),
                "height": pixel_dimensions.get(
                    "height",
                    abs(
                        bbox[3] - bbox[1]
                    )
                ),
            }

    except Exception as e:

        print(
            "Intelligence warning:",
            repr(e)
        )

        # ======================================================
        # FALLBACK
        # ======================================================

        detection[
            "priorityScore"
        ] = detection.get(
            "priorityScore",
            0
        )

        detection[
            "priorityLevel"
        ] = detection.get(
            "priorityLevel",
            "LOW"
        )

        detection[
            "ecoImpact"
        ] = detection.get(
            "ecoImpact",
            "Unknown"
        )

        detection[
            "actionRecommended"
        ] = detection.get(
            "actionRecommended",
            "Review detection"
        )

        detection[
            "pixelDimensions"
        ] = {
            "width": abs(
                bbox[2] - bbox[0]
            ),
            "height": abs(
                bbox[3] - bbox[1]
            ),
        }

    # ==========================================================
    # ALWAYS PRESENT FRONTEND FIELDS
    # ==========================================================

    if not detection.get(
        "pixelDimensions"
    ):

        detection[
            "pixelDimensions"
        ] = {
            "width": abs(
                bbox[2] - bbox[0]
            ),
            "height": abs(
                bbox[3] - bbox[1]
            ),
        }

    detection[
        "verificationStatus"
    ] = detection.get(
        "verificationStatus",
        "pending"
    )

    detection[
        "timestamp"
    ] = detection.get(
        "timestamp",
        time.strftime(
            "%Y-%m-%dT%H:%M:%SZ",
            time.gmtime()
        )
    )

    return detection


# ============================================================
# PROCESS IMAGE
# ============================================================

def process_image(
    image_bytes,
    filename
):

    start_time = time.time()

    (
        tensor,
        original_image,
        original_width,
        original_height,
        scale,
        pad_x,
        pad_y,
    ) = preprocess(
        image_bytes
    )

    # ========================================================
    # ONNX INFERENCE
    # ========================================================

    outputs = session.run(
        None,
        {
            input_name: tensor
        },
    )

    # ========================================================
    # PARSE PREDICTIONS
    # ========================================================

    detections = parse_predictions(
        outputs[0],
        original_width,
        original_height,
        scale,
        pad_x,
        pad_y,
    )

    # ========================================================
    # INTELLIGENCE
    # ========================================================

    enriched_detections = []

    for detection in detections:

        detection = add_intelligence_data(
            detection
        )

        enriched_detections.append(
            detection
        )

    detections = enriched_detections

    # ========================================================
    # ANNOTATED IMAGE
    # ========================================================

    annotated_image = draw_detections(
        original_image,
        detections,
    )

    # ========================================================
    # SAVE OUTPUT
    # ========================================================

    unique_id = uuid.uuid4().hex[:10]

    safe_name = Path(
        filename
    ).stem

    output_filename = (
        f"{safe_name}_"
        f"{unique_id}_"
        f"annotated.jpg"
    )

    output_path = (
        OUTPUT_DIR /
        output_filename
    )

    cv2.imwrite(
        str(output_path),
        annotated_image,
        [
            int(
                cv2.IMWRITE_JPEG_QUALITY
            ),
            85,
        ],
    )

    # ========================================================
    # PUBLIC URL
    # ========================================================

    image_url = (
        f"{BACKEND_PUBLIC_URL}"
        f"/outputs/"
        f"{output_filename}"
    )

    annotated_url = image_url

    # ========================================================
    # BASE64
    # ========================================================

    original_base64 = (
        image_to_base64(
            original_image
        )
    )

    annotated_base64 = (
        image_to_base64(
            annotated_image
        )
    )

    # ========================================================
    # SONAR QUALITY
    # ========================================================

    sonar_quality = None

    try:

        sonar_quality = (
            analyze_sonar_image_quality(
                image_bytes,
                detections=detections,
            )
        )

    except Exception as e:

        print(
            "Sonar quality warning:",
            repr(e)
        )

    # ========================================================
    # EVIDENCE ASSESSMENT
    # ========================================================

    if detections:

        evidence_assessment = {

            "status": "Detected",

            "message": (
                f"{len(detections)} "
                "object(s) detected by AI."
            ),
        }

    else:

        evidence_assessment = {

            "status": "No Detection",

            "message": (
                "No target objects detected "
                "above the confidence threshold."
            ),
        }

    # ========================================================
    # PROCESSING TIME
    # ========================================================

    processing_time_ms = int(
        (
            time.time()
            - start_time
        )
        * 1000
    )

    # ========================================================
    # FINAL RESPONSE
    # ========================================================

    result = {

        "success": True,

        "filename": filename,

        "fileSizeMB": round(
            len(image_bytes)
            / (1024 * 1024),
            3,
        ),

        "resolution": {

            "width": original_width,

            "height": original_height,
        },

        "imageUrl": image_url,

        "annotatedImageUrl": (
            annotated_url
        ),

        "imageBase64": (
            original_base64
        ),

        "annotatedBase64": (
            annotated_base64
        ),

        "detections": detections,

        "detection_count": len(
            detections
        ),

        "sonarQuality": (
            sonar_quality
        ),

        "sonar_quality": (
            sonar_quality
        ),

        "evidenceAssessment": (
            evidence_assessment
        ),

        "evidence_assessment": (
            evidence_assessment
        ),

        "processedAt": time.strftime(
            "%Y-%m-%dT%H:%M:%SZ",
            time.gmtime()
        ),

        "processingTimeMs": (
            processing_time_ms
        ),

        "modelVersion": (
            "YOLO11n-ONNX"
        ),

        "isSample": False,
    }

    # ========================================================
    # MEMORY CLEANUP
    # ========================================================

    del tensor
    del outputs
    del original_image
    del annotated_image

    gc.collect()

    return result


# ============================================================
# PREDICT
# ============================================================

@app.post("/predict")
async def predict(
    file: UploadFile = File(...)
):

    try:

        image_bytes = await file.read()

        if not image_bytes:

            raise HTTPException(
                status_code=400,
                detail="Empty file",
            )

        result = process_image(
            image_bytes,
            file.filename or "image.jpg",
        )

        # Save scan
        try:

            database.save_scan(
                result
            )

        except Exception as e:

            print(
                "Database save warning:",
                repr(e)
            )

        return result

    except HTTPException:
        raise

    except Exception as e:

        print(
            "Prediction error:",
            repr(e)
        )

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ============================================================
# BATCH PREDICT
# ============================================================

@app.post("/predict-batch")
async def predict_batch(
    files: list[UploadFile] = File(...)
):

    results = []

    for file in files:

        try:

            image_bytes = await file.read()

            if not image_bytes:
                continue

            result = process_image(
                image_bytes,
                file.filename or "image.jpg",
            )

            try:

                database.save_scan(
                    result
                )

            except Exception as e:

                print(
                    "Database save warning:",
                    repr(e)
                )

            results.append(
                result
            )

        except Exception as e:

            results.append({

                "success": False,

                "filename": (
                    file.filename
                ),

                "error": str(e),
            })

    return {

        "success": True,

        "count": len(results),

        "results": results,
    }


# ============================================================
# GET SCANS
# ============================================================

@app.get("/scans")
def get_scans(
    limit: int = 50
):

    try:

        return database.get_all_scans(
            limit=limit
        )

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ============================================================
# DELETE ALL SCANS
# ============================================================

@app.delete("/scans")
def delete_all_scans():

    try:

        database.clear_all_scans()

        return {

            "success": True,

            "message": (
                "All scans deleted"
            ),
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ============================================================
# DELETE SINGLE SCAN
# ============================================================

@app.delete("/scans/{scan_id}")
def delete_single_scan(
    scan_id: int
):

    try:

        database.delete_scan(
            scan_id
        )

        return {

            "success": True,

            "message": (
                "Scan deleted"
            ),
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ============================================================
# FEEDBACK
# ============================================================

@app.post("/feedback")
async def feedback(
    payload: dict
):

    try:

        database.record_hitl_feedback(
            payload
        )

        return {

            "success": True,

            "message": (
                "Feedback recorded"
            ),
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
async def startup_event():

    print("======================================")

    print(
        "DeepScan AI backend starting..."
    )

    print(
        "ONNX Runtime:",
        ort.__version__
    )

    print(
        "Model:",
        MODEL_PATH
    )

    print(
        "Input:",
        input_width,
        "x",
        input_height
    )

    print("======================================")
