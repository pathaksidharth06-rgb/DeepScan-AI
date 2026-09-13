import os

# ---------------------------------------------------------
# MEMORY OPTIMIZATION — MUST BE BEFORE ML IMPORTS
# ---------------------------------------------------------
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["NUMEXPR_NUM_THREADS"] = "1"
os.environ["MALLOC_TRIM_THRESHOLD_"] = "65536"

import gc
import base64
import io
import uuid
from datetime import datetime
from typing import List

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image

# ---------------------------------------------------------
# YOUR PROJECT MODULES
# ---------------------------------------------------------
from database import (
    save_scan,
    get_scans,
    delete_all_scans,
    delete_scan,
    save_feedback,
)

from intelligence import analyze_detection
from sonar_quality import analyze_sonar_quality

# ---------------------------------------------------------
# YOLO
# ---------------------------------------------------------
from ultralytics import YOLO


# ---------------------------------------------------------
# APP
# ---------------------------------------------------------
app = FastAPI(
    title="DeepScan AI API",
    description="AI-powered underwater sonar debris and anomaly detection",
    version="1.0.0",
)


# ---------------------------------------------------------
# CORS
# ---------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# CONFIG
# ---------------------------------------------------------
BACKEND_PUBLIC_URL = os.getenv(
    "BACKEND_PUBLIC_URL",
    "https://deepscan-ai-tyvx.onrender.com",
).rstrip("/")

MODEL_PATH = "best.pt"

# Smaller image size = lower memory usage
IMAGE_SIZE = 256

CONFIDENCE = 0.20

MAX_DETECTIONS = 10


# ---------------------------------------------------------
# MODEL
# ---------------------------------------------------------
print("Loading YOLO model...")

try:
    model = YOLO(MODEL_PATH)

    print("YOLO model loaded successfully.")

except Exception as e:
    print(f"ERROR loading YOLO model: {e}")
    model = None


# ---------------------------------------------------------
# MODEL CLASS NAMES
# ---------------------------------------------------------
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


# ---------------------------------------------------------
# UTILITY FUNCTIONS
# ---------------------------------------------------------
def image_to_base64(image: Image.Image, quality: int = 75) -> str:
    """
    Convert PIL image to compressed JPEG base64.
    Lower quality helps reduce memory and response size.
    """

    buffer = io.BytesIO()

    image.convert("RGB").save(
        buffer,
        format="JPEG",
        quality=quality,
        optimize=True,
    )

    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")

    buffer.close()

    return encoded


def resize_for_processing(image: Image.Image) -> Image.Image:
    """
    Resize large uploaded images before inference.
    This significantly reduces memory consumption.
    """

    image = image.convert("RGB")

    max_dimension = 1280

    if max(image.size) > max_dimension:
        ratio = max_dimension / max(image.size)

        new_width = int(image.width * ratio)
        new_height = int(image.height * ratio)

        image = image.resize(
            (new_width, new_height),
            Image.Resampling.LANCZOS,
        )

    return image


def cleanup_memory(*objects):
    """
    Explicitly release large objects.
    """

    for obj in objects:
        try:
            del obj
        except Exception:
            pass

    gc.collect()


# ---------------------------------------------------------
# HEALTH
# ---------------------------------------------------------
@app.get("/")
def root():
    return {
        "name": "DeepScan AI",
        "status": "online",
        "model": "YOLO11n",
        "backend": "FastAPI",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "model": "best.pt",
        "memory_optimized": True,
    }


# ---------------------------------------------------------
# IMAGE PROCESSING
# ---------------------------------------------------------
def process_image(image: Image.Image, filename: str):
    """
    Run YOLO inference and generate the complete scan result.
    """

    if model is None:
        raise RuntimeError("YOLO model is not loaded.")

    # -----------------------------------------------------
    # Prepare image
    # -----------------------------------------------------
    image = resize_for_processing(image)

    # -----------------------------------------------------
    # ORIGINAL IMAGE
    # -----------------------------------------------------
    original_base64 = image_to_base64(
        image,
        quality=70,
    )

    # -----------------------------------------------------
    # YOLO INFERENCE
    # -----------------------------------------------------
    try:
        results_generator = model.predict(
            source=image,
            imgsz=IMAGE_SIZE,
            conf=CONFIDENCE,
            max_det=MAX_DETECTIONS,
            device="cpu",
            verbose=False,
            stream=True,
        )

        # Only keep ONE result in memory
        result = next(iter(results_generator))

    except Exception as e:
        cleanup_memory(image)
        raise RuntimeError(f"YOLO inference failed: {str(e)}")

    # -----------------------------------------------------
    # DETECTIONS
    # -----------------------------------------------------
    detections = []

    try:
        boxes = result.boxes

        if boxes is not None:

            # Move only required data to CPU
            xyxy = boxes.xyxy.cpu().numpy()
            confs = boxes.conf.cpu().numpy()
            classes = boxes.cls.cpu().numpy()

            for i in range(len(classes)):

                class_id = int(classes[i])

                confidence = float(confs[i])

                box = xyxy[i]

                x1 = float(box[0])
                y1 = float(box[1])
                x2 = float(box[2])
                y2 = float(box[3])

                class_name = CLASS_NAMES.get(
                    class_id,
                    str(class_id),
                )

                # -----------------------------------------
                # INTELLIGENCE ANALYSIS
                # -----------------------------------------
                try:
                    intelligence = analyze_detection(
                        class_name,
                        confidence,
                    )
                except Exception:
                    intelligence = {}

                detection = {
                    "class_id": class_id,
                    "class_name": class_name,
                    "confidence": round(confidence, 4),
                    "bbox": [
                        round(x1, 2),
                        round(y1, 2),
                        round(x2, 2),
                        round(y2, 2),
                    ],
                    "intelligence": intelligence,
                }

                detections.append(detection)

            # Free temporary numpy arrays
            del xyxy
            del confs
            del classes

    except Exception as e:
        print(f"Detection parsing warning: {e}")

    # -----------------------------------------------------
    # ANNOTATED IMAGE
    # -----------------------------------------------------
    annotated_base64 = None

    try:
        plotted = result.plot()

        # result.plot() returns numpy array
        annotated_image = Image.fromarray(
            plotted[..., ::-1]
        )

        annotated_base64 = image_to_base64(
            annotated_image,
            quality=70,
        )

        del plotted
        del annotated_image

    except Exception as e:
        print(f"Annotation warning: {e}")

    # -----------------------------------------------------
    # SONAR QUALITY
    # -----------------------------------------------------
    try:
        sonar_quality = analyze_sonar_quality(image)
    except Exception as e:
        print(f"Sonar quality warning: {e}")

        sonar_quality = {
            "quality": "Unknown",
            "score": 0,
            "message": "Unable to analyze sonar quality.",
        }

    # -----------------------------------------------------
    # EVIDENCE ASSESSMENT
    # -----------------------------------------------------
    evidence = {
        "status": "No anomalies detected",
        "severity": "Low",
        "summary": "No significant objects detected.",
    }

    if detections:

        high_confidence = [
            d for d in detections
            if d["confidence"] >= 0.50
        ]

        if high_confidence:

            evidence = {
                "status": "Anomalies detected",
                "severity": "High",
                "summary": (
                    f"{len(high_confidence)} "
                    "high-confidence anomaly(s) detected."
                ),
            }

        else:

            evidence = {
                "status": "Potential anomalies detected",
                "severity": "Medium",
                "summary": (
                    f"{len(detections)} potential "
                    "object(s) detected."
                ),
            }

    # -----------------------------------------------------
    # SAVE ANNOTATED OUTPUT
    # -----------------------------------------------------
    output_filename = None

    try:
        output_dir = "outputs"

        os.makedirs(
            output_dir,
            exist_ok=True,
        )

        output_filename = (
            f"{uuid.uuid4().hex}_annotated.jpg"
        )

        output_path = os.path.join(
            output_dir,
            output_filename,
        )

        if annotated_base64:

            image_bytes = base64.b64decode(
                annotated_base64
            )

            with open(
                output_path,
                "wb",
            ) as f:
                f.write(image_bytes)

            del image_bytes

    except Exception as e:
        print(f"Output save warning: {e}")

    # -----------------------------------------------------
    # OUTPUT URL
    # -----------------------------------------------------
    annotated_url = None

    if output_filename:

        annotated_url = (
            f"{BACKEND_PUBLIC_URL}"
            f"/outputs/{output_filename}"
        )

    # -----------------------------------------------------
    # FINAL RESPONSE
    # -----------------------------------------------------
    response = {
        "success": True,
        "filename": filename,
        "timestamp": datetime.utcnow().isoformat(),
        "detections": detections,
        "detection_count": len(detections),
        "sonar_quality": sonar_quality,
        "evidence_assessment": evidence,
        "original_image": original_base64,
        "annotated_image": annotated_base64,
        "annotated_url": annotated_url,
    }

    # -----------------------------------------------------
    # SAVE DATABASE RECORD
    # -----------------------------------------------------
    try:

        scan_data = {
            "filename": filename,
            "detections": detections,
            "detection_count": len(detections),
            "sonar_quality": sonar_quality,
            "evidence_assessment": evidence,
            "annotated_url": annotated_url,
        }

        try:
            save_scan(scan_data)
        except TypeError:
            # If your existing database function expects
            # different arguments, don't crash the prediction.
            pass

    except Exception as e:
        print(f"Database save warning: {e}")

    # -----------------------------------------------------
    # VERY IMPORTANT MEMORY CLEANUP
    # -----------------------------------------------------
    try:
        del result
    except Exception:
        pass

    try:
        del results_generator
    except Exception:
        pass

    cleanup_memory(image)

    return response


# ---------------------------------------------------------
# SINGLE IMAGE PREDICTION
# ---------------------------------------------------------
@app.post("/predict")
async def predict(file: UploadFile = File(...)):

    if not file.content_type or not file.content_type.startswith(
        "image/"
    ):
        raise HTTPException(
            status_code=400,
            detail="Please upload a valid image.",
        )

    try:

        contents = await file.read()

        image = Image.open(
            io.BytesIO(contents)
        )

        # Force image load
        image.load()

        result = process_image(
            image,
            file.filename or "image.jpg",
        )

        del contents

        return JSONResponse(
            content=result
        )

    except Exception as e:

        gc.collect()

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ---------------------------------------------------------
# BATCH PREDICTION
# ---------------------------------------------------------
@app.post("/predict-batch")
async def predict_batch(
    files: List[UploadFile] = File(...)
):

    results = []

    # IMPORTANT:
    # Process ONE image at a time.
    # Never load all images into RAM.

    for file in files:

        try:

            if not file.content_type or not file.content_type.startswith(
                "image/"
            ):
                results.append(
                    {
                        "success": False,
                        "filename": file.filename,
                        "error": "Invalid image file.",
                    }
                )

                continue

            contents = await file.read()

            image = Image.open(
                io.BytesIO(contents)
            )

            image.load()

            result = process_image(
                image,
                file.filename or "image.jpg",
            )

            results.append(result)

            del contents
            del image

            gc.collect()

        except Exception as e:

            results.append(
                {
                    "success": False,
                    "filename": file.filename,
                    "error": str(e),
                }
            )

            gc.collect()

    return {
        "success": True,
        "count": len(results),
        "results": results,
    }


# ---------------------------------------------------------
# GET SCANS
# ---------------------------------------------------------
@app.get("/scans")
def scans():

    try:
        return get_scans()

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ---------------------------------------------------------
# DELETE ALL SCANS
# ---------------------------------------------------------
@app.delete("/scans")
def delete_scans():

    try:

        delete_all_scans()

        return {
            "success": True,
            "message": "All scans deleted.",
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ---------------------------------------------------------
# DELETE SINGLE SCAN
# ---------------------------------------------------------
@app.delete("/scans/{scan_id}")
def delete_single_scan(scan_id: int):

    try:

        delete_scan(scan_id)

        return {
            "success": True,
            "message": "Scan deleted.",
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ---------------------------------------------------------
# FEEDBACK
# ---------------------------------------------------------
@app.post("/feedback")
async def feedback(data: dict):

    try:

        save_feedback(data)

        return {
            "success": True,
            "message": "Feedback saved.",
        }

    except Exception as e:

        raise HTTPException(
            status_code=500,
            detail=str(e),
        )


# ---------------------------------------------------------
# OUTPUT FILES
# ---------------------------------------------------------
from fastapi.staticfiles import StaticFiles

os.makedirs(
    "outputs",
    exist_ok=True,
)

app.mount(
    "/outputs",
    StaticFiles(directory="outputs"),
    name="outputs",
)


# ---------------------------------------------------------
# STARTUP
# ---------------------------------------------------------
@app.on_event("startup")
async def startup_event():

    print("----------------------------------------")
    print("DeepScan AI Backend Started")
    print("----------------------------------------")
    print(f"Model: {MODEL_PATH}")
    print(f"Image Size: {IMAGE_SIZE}")
    print(f"Confidence: {CONFIDENCE}")
    print(f"Max Detections: {MAX_DETECTIONS}")
    print(f"Public URL: {BACKEND_PUBLIC_URL}")
    print("----------------------------------------")


# ---------------------------------------------------------
# SHUTDOWN
# ---------------------------------------------------------
@app.on_event("shutdown")
async def shutdown_event():

    global model

    try:
        del model
    except Exception:
        pass

    gc.collect()

    print("DeepScan AI Backend shutting down.")
