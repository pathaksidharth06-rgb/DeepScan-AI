"""
DeepScan AI - FastAPI Inference & Decision Support Server

Loads the trained YOLO11n model (best.pt), performs sonar detection,
runs the Intelligence Engine and Sonar Quality Analyzer, and stores
scan history in SQLite.

Optimized for low-memory deployment such as Render Free (512 MB).
"""

import os
import uuid
import base64
import io
import gc
from datetime import datetime

from PIL import Image

from fastapi import FastAPI, UploadFile, File, Form
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from ultralytics import YOLO

from intelligence import get_intelligence
from sonar_quality import analyze_sonar_image_quality
import database


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="DeepScan AI - Underwater Sonar Intelligence API",
    version="2.0.0",
    description=(
        "Live YOLO11n (best.pt) inference and decision-support API "
        "for Side-Scan Sonar (SSS) imagery"
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
# DIRECTORIES
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

OUTPUTS_DIR = os.path.join(
    BASE_DIR,
    "outputs"
)

os.makedirs(
    OUTPUTS_DIR,
    exist_ok=True
)


# Serve generated images
app.mount(
    "/outputs",
    StaticFiles(directory=OUTPUTS_DIR),
    name="outputs"
)


# ============================================================
# PUBLIC BACKEND URL
# ============================================================

# Render production URL.
# Can also be overridden with BACKEND_PUBLIC_URL environment variable.
BACKEND_PUBLIC_URL = os.getenv(
    "BACKEND_PUBLIC_URL",
    "https://deepscan-ai-tyvx.onrender.com"
).rstrip("/")


# ============================================================
# MODEL PATH
# ============================================================

MODEL_PATH = os.path.join(
    BASE_DIR,
    "best.pt"
)


# ============================================================
# LOAD YOLO MODEL
# ============================================================

print("==============================================")
print("          DEEPSCAN AI BACKEND")
print("==============================================")

print("Loading YOLO11n weights from:")
print(MODEL_PATH)


if not os.path.exists(MODEL_PATH):
    raise FileNotFoundError(
        f"YOLO model not found: {MODEL_PATH}"
    )


model = YOLO(MODEL_PATH)


print(
    "YOLO11n model loaded successfully with classes:"
)
print(model.names)

print("==============================================")


# ============================================================
# STARTUP
# ============================================================

@app.on_event("startup")
def startup():
    print("Initializing database...")
    database.init_db()
    print("Database initialized successfully.")


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health_check():

    return {
        "status": "ONLINE",
        "model": "YOLO11n (best.pt)",
        "classes": model.names,
        "taxonomy_classes": len(model.names),
        "sonar_quality_analyzer": "ACTIVE",
        "quality_modules": [
            "speckle_noise",
            "resolution_quality",
            "acoustic_shadow",
            "motion_dropout",
            "evidence_score"
        ]
    }


# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {
        "message": "DeepScan AI Backend is running",
        "status": "online",
        "model": "YOLO11n (best.pt)",
        "classes": model.names,
        "number_of_classes": len(model.names),
        "backend_url": BACKEND_PUBLIC_URL
    }


# ============================================================
# IMAGE PROCESSING
# ============================================================

def process_image(
    image_bytes: bytes,
    filename: str
) -> dict:

    scan_id = f"scan-{uuid.uuid4().hex[:8]}"

    # --------------------------------------------------------
    # OPEN IMAGE
    # --------------------------------------------------------

    image = Image.open(
        io.BytesIO(image_bytes)
    ).convert("RGB")

    width, height = image.size

    file_size_mb = round(
        len(image_bytes) / (1024 * 1024),
        2
    )

    start_time = datetime.now()


    # ========================================================
    # YOLO INFERENCE
    # ========================================================

    print(
        f"Starting YOLO inference for {filename}"
    )

    print(
        "Using memory-optimized inference: imgsz=320, max_det=20"
    )

    results = model.predict(
        source=image,

        # LOWER IMAGE SIZE = LOWER RAM USAGE
        imgsz=320,

        # Same detection confidence threshold
        conf=0.15,

        # Prevent excessive detections/memory
        max_det=20,

        # Disable unnecessary logging
        verbose=False,

        # Explicit CPU inference for Render
        device="cpu"
    )

    result = results[0]


    processing_time_ms = int(
        (
            datetime.now() - start_time
        ).total_seconds() * 1000
    )


    print(
        f"YOLO inference completed in "
        f"{processing_time_ms} ms"
    )


    # ========================================================
    # GENERATE ANNOTATED IMAGE
    # ========================================================

    annotated_plot = result.plot()

    annotated_pil = Image.fromarray(
        annotated_plot
    )


    # ========================================================
    # OUTPUT FILES
    # ========================================================

    orig_path = os.path.join(
        OUTPUTS_DIR,
        f"{scan_id}.jpg"
    )

    annotated_path = os.path.join(
        OUTPUTS_DIR,
        f"{scan_id}_annotated.jpg"
    )


    # Save original image
    image.save(
        orig_path,
        format="JPEG",
        quality=85,
        optimize=True
    )


    # Save annotated image
    annotated_pil.save(
        annotated_path,
        format="JPEG",
        quality=85,
        optimize=True
    )


    # ========================================================
    # PRODUCTION IMAGE URLS
    # ========================================================

    image_url = (
        f"{BACKEND_PUBLIC_URL}"
        f"/outputs/{scan_id}.jpg"
    )

    annotated_image_url = (
        f"{BACKEND_PUBLIC_URL}"
        f"/outputs/{scan_id}_annotated.jpg"
    )


    # ========================================================
    # BASE64 IMAGES
    # ========================================================

    # Annotated image
    buffer = io.BytesIO()

    annotated_pil.save(
        buffer,
        format="JPEG",
        quality=75,
        optimize=True
    )

    annotated_base64 = (
        "data:image/jpeg;base64,"
        + base64.b64encode(
            buffer.getvalue()
        ).decode("utf-8")
    )


    # Original image
    orig_buffer = io.BytesIO()

    image.save(
        orig_buffer,
        format="JPEG",
        quality=75,
        optimize=True
    )

    orig_base64 = (
        "data:image/jpeg;base64,"
        + base64.b64encode(
            orig_buffer.getvalue()
        ).decode("utf-8")
    )


    # ========================================================
    # EXTRACT REAL YOLO DETECTIONS
    # ========================================================

    detections = []


    if (
        result.boxes is not None
        and len(result.boxes) > 0
    ):

        boxes = (
            result.boxes.xyxy
            .cpu()
            .numpy()
        )

        confs = (
            result.boxes.conf
            .cpu()
            .numpy()
        )

        classes = (
            result.boxes.cls
            .cpu()
            .numpy()
        )


        for i in range(len(boxes)):

            x1, y1, x2, y2 = [
                float(v)
                for v in boxes[i]
            ]

            conf = float(
                confs[i]
            )

            cls_idx = int(
                classes[i]
            )

            cls_name = model.names.get(
                cls_idx,
                "Unknown Anomaly"
            )


            # ------------------------------------------------
            # INTELLIGENCE ENGINE
            # ------------------------------------------------

            intel = get_intelligence(
                cls_name,
                conf,
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
                    cls_name,

                "category":
                    intel["category"],

                "confidence":
                    round(conf, 2),

                "bbox": [
                    round(x1, 2),
                    round(y1, 2),
                    round(x2, 2),
                    round(y2, 2)
                ],

                "pixelDimensions":
                    intel["pixel_dimensions"],

                "priorityScore":
                    intel["priority_score"],

                "priorityLevel":
                    intel["priority_level"],

                "ecoImpact":
                    intel["eco_impact"],

                "actionRecommended":
                    intel["action_recommended"],

                "verificationStatus":
                    "unreviewed",

                "timestamp":
                    datetime.utcnow().isoformat()
            })


    print(
        f"Detections found: {len(detections)}"
    )


    # ========================================================
    # SONAR QUALITY ANALYZER
    # ========================================================

    sonar_quality_payload = None

    evidence_assessment_payload = None

    sq = None
    ea = None


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


        # ----------------------------------------------------
        # FRONTEND COMPATIBILITY
        # ----------------------------------------------------

        for det in final_detections:

            if "acoustic_shadow" in det:

                det["shadowMetrics"] = {

                    "shadowDetected":
                        det[
                            "acoustic_shadow"
                        ].get(
                            "shadow_detected",
                            False
                        ),

                    "shadowContrastRatio":
                        det[
                            "acoustic_shadow"
                        ].get(
                            "shadow_contrast_ratio",
                            1.0
                        ),

                    "evidenceStrength":
                        det[
                            "acoustic_shadow"
                        ].get(
                            "evidence_strength",
                            "ABSENT"
                        ),

                    "description":
                        det[
                            "acoustic_shadow"
                        ].get(
                            "description",
                            ""
                        )
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


        # ----------------------------------------------------
        # SONAR QUALITY RESPONSE
        # ----------------------------------------------------

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


    except Exception as q_err:

        print(
            "Warning: Sonar quality analysis failed:",
            q_err
        )

        final_detections = detections

        sonar_quality_payload = None

        evidence_assessment_payload = None

        sq = None
        ea = None


    # ========================================================
    # SCAN DATA
    # ========================================================

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
                10,
                processing_time_ms
            ),

        "modelVersion":
            "YOLO11n (best.pt)",

        "isSample":
            False
    }


    # ========================================================
    # SAVE TO DATABASE
    # ========================================================

    try:

        database.save_scan(

            {
                "id":
                    scan_id,

                "filename":
                    filename,

                "file_size_mb":
                    file_size_mb,

                "resolution": {
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


    except Exception as e:

        print(
            "Error saving to database:",
            e
        )


    # ========================================================
    # MEMORY CLEANUP
    # ========================================================

    try:

        del results
        del result
        del annotated_plot
        del annotated_pil

    except Exception:
        pass


    gc.collect()


    print(
        f"Scan completed successfully: {scan_id}"
    )


    return scan_data


# ============================================================
# SINGLE IMAGE PREDICTION
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
# BATCH PREDICTION
# ============================================================

@app.post("/predict-batch")
async def predict_batch(
    files: list[UploadFile] = File(...)
):

    """
    Batch inference for multiple sonar frames.

    Images are processed one-by-one instead of simultaneously
    to keep RAM usage low.
    """

    scans = []

    for file in files:

        contents = await file.read()

        scan = process_image(
            contents,
            file.filename
        )

        scans.append(scan)

        gc.collect()


    return scans


# ============================================================
# GET SCAN HISTORY
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
# CLEAR ALL HISTORY
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
# HUMAN-IN-THE-LOOP FEEDBACK
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
# LOCAL DEVELOPMENT
# ============================================================

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000
    )
