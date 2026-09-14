"""
DeepScan AI - SQLite Database Interface
Stores scan history, detections, and operator review feedback (HITL).
"""

import sqlite3
import json
import os
from datetime import datetime

DB_PATH = "deepscan.db"

BACKEND_PUBLIC_URL = os.getenv(
    "BACKEND_PUBLIC_URL",
    "https://deepscan-ai-tyvx.onrender.com"
).rstrip("/")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS scans (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        file_size_mb REAL,
        resolution TEXT,
        processed_at TEXT,
        processing_time_ms INTEGER,
        model_version TEXT,
        sonar_quality_json TEXT,
        evidence_assessment_json TEXT
    )
    """)

    # Safe migrations for existing SQLite tables
    cursor.execute("PRAGMA table_info(scans)")
    existing_cols = {row[1] for row in cursor.fetchall()}

    if "sonar_quality_json" not in existing_cols:
        cursor.execute(
            "ALTER TABLE scans ADD COLUMN sonar_quality_json TEXT"
        )

    if "evidence_assessment_json" not in existing_cols:
        cursor.execute(
            "ALTER TABLE scans ADD COLUMN evidence_assessment_json TEXT"
        )

    if "image_url" not in existing_cols:
        cursor.execute(
            "ALTER TABLE scans ADD COLUMN image_url TEXT"
        )

    if "annotated_image_url" not in existing_cols:
        cursor.execute(
            "ALTER TABLE scans ADD COLUMN annotated_image_url TEXT"
        )

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS detections (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL,
        class_name TEXT NOT NULL,
        category TEXT,
        confidence REAL,
        bbox TEXT,
        pixel_dimensions TEXT,
        priority_score INTEGER,
        priority_level TEXT,
        eco_impact TEXT,
        action_recommended TEXT,
        verification_status TEXT DEFAULT 'unreviewed',
        FOREIGN KEY(scan_id) REFERENCES scans(id)
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS hitl_feedback (
        id TEXT PRIMARY KEY,
        scan_id TEXT NOT NULL,
        detection_id TEXT NOT NULL,
        original_class TEXT,
        verified_class TEXT,
        confidence REAL,
        status TEXT,
        operator_role TEXT,
        notes TEXT,
        timestamp TEXT
    )
    """)

    conn.commit()
    conn.close()


def save_scan(scan_data: dict, detections: list):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Correct public Render URLs
    img_url = (
        scan_data.get("image_url")
        or scan_data.get("imageUrl")
        or f"{BACKEND_PUBLIC_URL}/outputs/{scan_data['id']}.jpg"
    )

    annotated_url = (
        scan_data.get("annotated_image_url")
        or scan_data.get("annotatedImageUrl")
        or f"{BACKEND_PUBLIC_URL}/outputs/{scan_data['id']}_annotated.jpg"
    )

    # Convert old localhost URLs if they somehow arrive
    if img_url.startswith("http://localhost:8000"):
        img_url = img_url.replace(
            "http://localhost:8000",
            BACKEND_PUBLIC_URL
        )

    if annotated_url.startswith("http://localhost:8000"):
        annotated_url = annotated_url.replace(
            "http://localhost:8000",
            BACKEND_PUBLIC_URL
        )

    if img_url.startswith("/outputs"):
        img_url = f"{BACKEND_PUBLIC_URL}{img_url}"

    if annotated_url.startswith("/outputs"):
        annotated_url = f"{BACKEND_PUBLIC_URL}{annotated_url}"

    cursor.execute("""
    INSERT OR REPLACE INTO scans (
        id,
        filename,
        file_size_mb,
        resolution,
        processed_at,
        processing_time_ms,
        model_version,
        sonar_quality_json,
        evidence_assessment_json,
        image_url,
        annotated_image_url
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        scan_data["id"],
        scan_data["filename"],
        scan_data.get("file_size_mb", 0.0),
        json.dumps(scan_data.get("resolution", {})),
        scan_data.get(
            "processed_at",
            datetime.utcnow().isoformat()
        ),
        scan_data.get("processing_time_ms", 40),
        scan_data.get("model_version", "YOLO11n"),

        json.dumps(
            scan_data.get("sonarQuality")
            or scan_data.get("sonar_quality")
        )
        if (
            scan_data.get("sonarQuality")
            or scan_data.get("sonar_quality")
        )
        else None,

        json.dumps(
            scan_data.get("evidenceAssessment")
            or scan_data.get("evidence_assessment")
        )
        if (
            scan_data.get("evidenceAssessment")
            or scan_data.get("evidence_assessment")
        )
        else None,

        img_url,
        annotated_url
    ))

    for d in detections:
        cursor.execute("""
        INSERT OR REPLACE INTO detections VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        """, (
            d["id"],
            scan_data["id"],
            d["className"],
            d["category"],
            d["confidence"],
            json.dumps(d["bbox"]),
            json.dumps(d["pixelDimensions"]),
            d["priorityScore"],
            d["priorityLevel"],
            d["ecoImpact"],
            d["actionRecommended"],
            d.get("verificationStatus", "unreviewed")
        ))

    conn.commit()
    conn.close()


def record_hitl_feedback(feedback: dict):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("""
    INSERT INTO hitl_feedback VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    )
    """, (
        feedback["id"],
        feedback["scan_id"],
        feedback["detection_id"],
        feedback["original_class"],
        feedback["verified_class"],
        feedback["confidence"],
        feedback["status"],
        feedback.get(
            "operator_role",
            "Hydrographic Operator"
        ),
        feedback.get("notes", ""),
        feedback.get(
            "timestamp",
            datetime.utcnow().isoformat()
        )
    ))

    conn.commit()
    conn.close()


def get_all_scans(limit: int = 200) -> list:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # IMPORTANT:
    # image_url and annotated_image_url are included here.
    cursor.execute("""
    SELECT
        id,
        filename,
        file_size_mb,
        resolution,
        processed_at,
        processing_time_ms,
        model_version,
        sonar_quality_json,
        evidence_assessment_json,
        image_url,
        annotated_image_url
    FROM scans
    ORDER BY rowid DESC
    LIMIT ?
    """, (limit,))

    rows = cursor.fetchall()
    results = []

    for r in rows:
        scan_id = r["id"]

        cursor.execute("""
        SELECT
            id,
            class_name,
            category,
            confidence,
            bbox,
            pixel_dimensions,
            priority_score,
            priority_level,
            eco_impact,
            action_recommended,
            verification_status
        FROM detections
        WHERE scan_id = ?
        """, (scan_id,))

        det_rows = cursor.fetchall()

        detections = []

        for d in det_rows:

            try:
                bbox_val = (
                    json.loads(d["bbox"])
                    if d["bbox"]
                    else [0, 0, 0, 0]
                )
            except Exception:
                bbox_val = [0, 0, 0, 0]

            try:
                dim_val = (
                    json.loads(d["pixel_dimensions"])
                    if d["pixel_dimensions"]
                    else {"width": 0, "height": 0}
                )
            except Exception:
                dim_val = {
                    "width": 0,
                    "height": 0
                }

            detections.append({
                "id": d["id"],
                "className": d["class_name"],
                "category": (
                    d["category"]
                    or "Marine Debris / Anthropogenic"
                ),
                "confidence": d["confidence"] or 0.0,
                "bbox": bbox_val,
                "pixelDimensions": dim_val,
                "priorityScore": d["priority_score"] or 0,
                "priorityLevel": d["priority_level"] or "LOW",
                "ecoImpact": (
                    d["eco_impact"]
                    or "Low Threat"
                ),
                "actionRecommended": (
                    d["action_recommended"]
                    or "No immediate action required"
                ),
                "verificationStatus": (
                    d["verification_status"]
                    or "unreviewed"
                ),
                "timestamp": r["processed_at"]
            })

        try:
            sq = (
                json.loads(r["sonar_quality_json"])
                if r["sonar_quality_json"]
                else None
            )
        except Exception:
            sq = None

        try:
            ea = (
                json.loads(r["evidence_assessment_json"])
                if r["evidence_assessment_json"]
                else None
            )
        except Exception:
            ea = None

        try:
            res_val = (
                json.loads(r["resolution"])
                if r["resolution"]
                else {
                    "width": 1024,
                    "height": 800
                }
            )
        except Exception:
            res_val = {
                "width": 1024,
                "height": 800
            }

        # Get stored image URLs
        img_url = r["image_url"]
        annotated_url = r["annotated_image_url"]

        # Fallback for old records
        if not img_url:
            img_url = (
                f"{BACKEND_PUBLIC_URL}/outputs/"
                f"{scan_id}.jpg"
            )

        if not annotated_url:
            annotated_url = (
                f"{BACKEND_PUBLIC_URL}/outputs/"
                f"{scan_id}_annotated.jpg"
            )

        # Convert relative URLs
        if img_url.startswith("/outputs"):
            img_url = f"{BACKEND_PUBLIC_URL}{img_url}"

        if annotated_url.startswith("/outputs"):
            annotated_url = (
                f"{BACKEND_PUBLIC_URL}{annotated_url}"
            )

        # Convert old localhost URLs
        if img_url.startswith("http://localhost:8000"):
            img_url = img_url.replace(
                "http://localhost:8000",
                BACKEND_PUBLIC_URL
            )

        if annotated_url.startswith("http://localhost:8000"):
            annotated_url = annotated_url.replace(
                "http://localhost:8000",
                BACKEND_PUBLIC_URL
            )

        results.append({
            "id": scan_id,
            "filename": r["filename"],
            "fileSizeMB": r["file_size_mb"] or 0.01,
            "resolution": res_val,

            "imageUrl": img_url,
            "annotatedImageUrl": annotated_url,

            "detections": detections,

            "sonarQuality": sq,
            "evidenceAssessment": ea,

            "processedAt": r["processed_at"],
            "processingTimeMs": (
                r["processing_time_ms"] or 35
            ),
            "modelVersion": (
                r["model_version"]
                or "YOLO11n (best.pt)"
            ),
            "isSample": False
        })

    conn.close()
    return results


def delete_scan(scan_id: str) -> bool:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        "DELETE FROM detections WHERE scan_id = ?",
        (scan_id,)
    )

    cursor.execute(
        "DELETE FROM scans WHERE id = ?",
        (scan_id,)
    )

    cursor.execute(
        "DELETE FROM hitl_feedback WHERE scan_id = ?",
        (scan_id,)
    )

    conn.commit()
    conn.close()

    # Clean up image files
    outputs_dir = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "outputs"
    )

    for fname in [
        f"{scan_id}.jpg",
        f"{scan_id}_annotated.jpg"
    ]:
        fpath = os.path.join(outputs_dir, fname)

        if os.path.exists(fpath):
            try:
                os.remove(fpath)
            except Exception:
                pass

    return True


def clear_all_scans() -> bool:
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM detections")
    cursor.execute("DELETE FROM scans")
    cursor.execute("DELETE FROM hitl_feedback")

    conn.commit()
    conn.close()

    # Clean up all generated images
    outputs_dir = os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "outputs"
    )

    if os.path.exists(outputs_dir):
        for f in os.listdir(outputs_dir):
            if f.endswith(".jpg") or f.endswith(".png"):
                try:
                    os.remove(
                        os.path.join(outputs_dir, f)
                    )
                except Exception:
                    pass

    return True
