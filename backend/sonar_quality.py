"""
DeepScan AI - Sonar Quality Analyzer Engine
===========================================
Classical computer-vision and image-processing layer for Side-Scan Sonar (SSS) imagery.
Analyzes four real-world hydrographic conditions:
  1. Speckle Noise (multi-patch local coefficient of variation)
  2. Varying 2D Resolution & Image Quality (Laplacian variance, Tenengrad gradient energy, dynamic range)
  3. Acoustic Shadow Evidence (target highlight vs. adjacent trailing low-backscatter shadow contrast)
  4. Motion-related image artifact / dropout assessment (row-by-row profile, scanline ping loss)

IMPORTANT SCIENTIFIC & HYDROGRAPHIC NOTICE:
This layer strictly measures 2D image-level artifacts from pixel data.
It does NOT claim that physical towfish heave, pitch, roll, or altitude kinematics
can be directly measured or recovered from a single 2D image without external IMU / AHRS sensor telemetry.
"""

from typing import Dict, Any, List, Optional, Tuple, Union
import io
import numpy as np
import cv2
from PIL import Image


def _to_grayscale_numpy(image_input: Union[bytes, Image.Image, np.ndarray]) -> np.ndarray:
    """
    Converts raw image bytes, PIL Image, or numpy array to single-channel uint8 grayscale.
    """
    if isinstance(image_input, bytes):
        pil_img = Image.open(io.BytesIO(image_input))
        img_np = np.array(pil_img)
    elif isinstance(image_input, Image.Image):
        img_np = np.array(image_input)
    elif isinstance(image_input, np.ndarray):
        img_np = image_input
    else:
        raise ValueError(f"Unsupported image input type: {type(image_input)}")

    if img_np.ndim == 3:
        if img_np.shape[2] == 4:  # RGBA
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGBA2GRAY)
        elif img_np.shape[2] == 3:  # RGB / BGR
            gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_np[:, :, 0]
    elif img_np.ndim == 2:
        gray = img_np
    else:
        raise ValueError(f"Unexpected array dimension: {img_np.shape}")

    if gray.dtype != np.uint8:
        gray = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)

    return gray


def analyze_speckle_noise(gray: np.ndarray, patch_size: int = 24) -> Dict[str, Any]:
    """
    Analyzes coherent acoustic speckle noise in side-scan sonar imagery.
    Uses local patch coefficient of variation: C_v = sigma / mu over seabed backscatter.
    Rayleigh theoretical scattering yields C_v ~ 0.52 for homogeneous speckle.
    """
    h, w = gray.shape
    if h < patch_size or w < patch_size:
        return {
            "speckle_index": None,
            "speckle_level": "UNAVAILABLE",
            "enl": None,
            "score": None,
            "description": "Image dimensions too compact for multi-patch speckle analysis."
        }

    cv_list = []
    for y in range(0, h - patch_size + 1, patch_size):
        for x in range(0, w - patch_size + 1, patch_size):
            patch = gray[y : y + patch_size, x : x + patch_size].astype(np.float32)
            mu = float(np.mean(patch))
            sigma = float(np.std(patch))
            if 15.0 < mu < 235.0 and sigma > 1.0:
                cv_val = sigma / mu
                cv_list.append(cv_val)

    if not cv_list:
        return {
            "speckle_index": None,
            "speckle_level": "UNAVAILABLE",
            "enl": None,
            "score": None,
            "description": "Insufficient valid seabed backscatter patches detected for speckle analysis."
        }

    speckle_index = float(np.median(cv_list))
    enl = round(float(1.0 / (max(speckle_index, 0.05) ** 2)), 2)
    speckle_index_rounded = round(speckle_index, 3)

    if speckle_index < 0.35:
        level = "LOW"
        desc = "Low acoustic speckle interference; coherent seafloor backscatter textures are cleanly preserved."
        score = min(100, max(80, int(100 - (speckle_index / 0.35) * 20)))
    elif speckle_index < 0.65:
        level = "MODERATE"
        desc = "Typical coherent acoustic speckle characteristic of standard side-scan sonar seabed scattering."
        score = min(80, max(50, int(80 - ((speckle_index - 0.35) / 0.30) * 30)))
    else:
        level = "SEVERE"
        desc = "Elevated acoustic speckle interference; high acoustic graininess may degrade target boundary sharpness."
        score = min(50, max(15, int(50 - ((speckle_index - 0.65) / 0.40) * 35)))

    return {
        "speckle_index": speckle_index_rounded,
        "speckle_level": level,
        "enl": enl,
        "score": score,
        "description": desc
    }


def analyze_resolution_quality(gray: np.ndarray) -> Dict[str, Any]:
    """
    Evaluates 2D image-level sharpness, contrast, and gradient definition.
    Explicitly clarifies the distinction between 2D pixel resolution and physical spatial resolution.
    """
    h, w = gray.shape

    # 1. Sharpness via Laplacian variance
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    lap_var = float(laplacian.var())

    # Tenengrad gradient energy (Sobel magnitude)
    sobel_x = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)
    sobel_y = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)
    grad_mag = np.sqrt(sobel_x**2 + sobel_y**2)
    mean_grad = float(np.mean(grad_mag))

    # Normalized sharpness score (0 to 100)
    sharpness_score = int(min(100, max(5, np.log1p(lap_var) * 13.5)))

    # 2. Dynamic range and contrast (5th to 95th percentile spread)
    p5, p95 = np.percentile(gray, [5, 95])
    intensity_range = float(p95 - p5)
    contrast_score = int(min(100, max(10, (intensity_range / 210.0) * 100)))

    # 3. Overall quality category
    composite_score = int(0.55 * sharpness_score + 0.45 * contrast_score)
    if composite_score >= 68:
        quality_rating = "OPTIMAL"
        desc = "High acoustic contrast with crisp gradient definition across seafloor contacts."
    elif composite_score >= 42:
        quality_rating = "ACCEPTABLE"
        desc = "Adequate image fidelity suitable for neural detection; minor attenuation present."
    else:
        quality_rating = "POOR"
        desc = "Sub-optimal image fidelity; low dynamic range or acoustic defocusing observed."

    return {
        "width": w,
        "height": h,
        "sharpness_score": sharpness_score,
        "laplacian_variance": round(lap_var, 1),
        "mean_gradient": round(mean_grad, 2),
        "contrast_score": contrast_score,
        "dynamic_range": round(intensity_range, 1),
        "quality_rating": quality_rating,
        "composite_score": composite_score,
        "description": desc,
        "disclaimer": (
            "Evaluates 2D image pixel definition and acoustic gradient contrast. "
            "Physical across-track/along-track spatial resolution is determined by sonar "
            "transducer frequency (kHz), beamwidth, pulse length, and towfish altitude metadata."
        )
    }


def analyze_acoustic_shadow(
    gray: np.ndarray,
    bbox: Optional[Union[List[float], Tuple[float, float, float, float]]] = None
) -> Dict[str, Any]:
    """
    Evaluates Acoustic Shadow Evidence for target elevation corroboration.
    In Side-Scan Sonar, an elevated physical contact creates a strong reflection (highlight)
    followed laterally by an acoustic shadow zone (zero/low backscatter where sound is occluded).
    """
    h, w = gray.shape

    if bbox is not None and len(bbox) == 4:
        x1, y1, x2, y2 = [int(round(v)) for v in bbox]
        x1 = max(0, min(w - 1, x1))
        x2 = max(0, min(w, x2))
        y1 = max(0, min(h - 1, y1))
        y2 = max(0, min(h, y2))

        box_w = max(1, x2 - x1)
        box_h = max(1, y2 - y1)

        target_roi = gray[y1:y2, x1:x2].astype(np.float32)
        target_mean = float(np.mean(target_roi)) if target_roi.size > 0 else float(np.mean(gray))

        flank_w = int(max(box_w * 1.4, 16))
        rx1, rx2 = x2, min(w, x2 + flank_w)
        right_shadow_roi = gray[y1:y2, rx1:rx2] if rx2 > rx1 else None

        lx1, lx2 = max(0, x1 - flank_w), x1
        left_shadow_roi = gray[y1:y2, lx1:lx2] if lx2 > lx1 else None

        right_mean = float(np.mean(right_shadow_roi)) if right_shadow_roi is not None and right_shadow_roi.size > 0 else 255.0
        left_mean = float(np.mean(left_shadow_roi)) if left_shadow_roi is not None and left_shadow_roi.size > 0 else 255.0

        shadow_mean = min(right_mean, left_mean)
        shadow_flank = "right" if right_mean < left_mean else "left"
        contrast_ratio = round((target_mean + 1.0) / (shadow_mean + 1.0), 2)
    else:
        dark_mask = gray < 30
        bright_mask = gray > 140

        dark_mean = float(np.mean(gray[dark_mask])) if np.any(dark_mask) else 15.0
        bright_mean = float(np.mean(gray[bright_mask])) if np.any(bright_mask) else 160.0
        contrast_ratio = round((bright_mean + 1.0) / (dark_mean + 1.0), 2)
        target_mean = bright_mean
        shadow_mean = dark_mean
        shadow_flank = "swath_bilateral"

    if contrast_ratio >= 2.2 and shadow_mean <= 65.0:
        evidence_strength = "STRONG"
        shadow_detected = True
        desc = (
            f"Strong acoustic shadow corroboration ({contrast_ratio}x contrast on {shadow_flank} flank); "
            "confirms significant 3D structural elevation above the seafloor."
        )
    elif contrast_ratio >= 1.45 and shadow_mean <= 95.0:
        evidence_strength = "MODERATE"
        shadow_detected = True
        desc = (
            f"Moderate acoustic shadow presence ({contrast_ratio}x contrast); "
            "indicates low-to-medium physical relief above surrounding sediment."
        )
    elif contrast_ratio >= 1.15:
        evidence_strength = "WEAK"
        shadow_detected = False
        desc = (
            f"Weak acoustic shadow signature ({contrast_ratio}x contrast); "
            "contact may be semi-buried, flat against the seabed, or an acoustic reflection artifact."
        )
    else:
        evidence_strength = "ABSENT"
        shadow_detected = False
        desc = (
            "No discernible acoustic shadow detected trailing this contact; "
            "potential flush anomaly or planar sediment variation."
        )

    return {
        "shadow_detected": shadow_detected,
        "shadow_contrast_ratio": contrast_ratio,
        "evidence_strength": evidence_strength,
        "target_intensity": round(target_mean, 1),
        "shadow_intensity": round(shadow_mean, 1),
        "description": desc,
        "methodology": "Classical lateral across-track highlight-to-shadow radiometric contrast analysis."
    }


def analyze_motion_dropout(gray: np.ndarray) -> Dict[str, Any]:
    """
    Motion-related image artifact / dropout assessment.
    Detects image-level scanline dropouts, missing acoustic pings, and along-track banding.
    Evaluates row-by-row profile across the along-track dimension.

    IMPORTANT SCIENTIFIC NOTICE:
    Distinguishes 2D image-level artifacts from physical towfish kinematics.
    Does NOT claim physical heave/pitch/roll without external IMU / AHRS telemetry.
    """
    h, w = gray.shape

    row_means = np.mean(gray, axis=1)
    row_stds = np.std(gray, axis=1)

    dropout_rows = np.where((row_means < 12.0) & (row_stds < 6.0))[0]
    num_dropouts = int(len(dropout_rows))
    dropout_percentage = round((num_dropouts / max(1, h)) * 100.0, 2)

    row_diffs = np.abs(np.diff(row_means))
    mean_row_jitter = float(np.mean(row_diffs))
    max_row_jitter = float(np.max(row_diffs)) if len(row_diffs) > 0 else 0.0

    detected_artifacts: List[str] = []
    if num_dropouts > 0:
        detected_artifacts.append(
            f"Acoustic scanline dropout detected ({num_dropouts} missing ping lines, {dropout_percentage}% of frame)."
        )

    if mean_row_jitter > 14.0 or max_row_jitter > 45.0:
        detected_artifacts.append(
            f"Pronounced row-to-row intensity banding observed (mean delta={round(mean_row_jitter, 1)}), "
            "suggesting towfish motion instability or surface boundary reflection."
        )
    elif mean_row_jitter > 8.0:
        detected_artifacts.append(
            f"Minor along-track scanline banding (mean delta={round(mean_row_jitter, 1)})."
        )

    if dropout_percentage >= 5.0 or mean_row_jitter >= 20.0:
        severity = "SEVERE"
        dropout_detected = True
        desc = "Severe image-level scanline dropouts or banding artifacts present; manual survey validation required."
    elif dropout_percentage >= 1.0 or mean_row_jitter >= 12.0:
        severity = "MODERATE"
        dropout_detected = True
        desc = "Moderate scanline artifacts detected; may slightly affect boundary segmentation."
    elif dropout_percentage > 0.0 or mean_row_jitter >= 7.0:
        severity = "LOW"
        dropout_detected = num_dropouts > 0
        desc = "Minor acoustic line noise or isolated dropped pings detected; negligible impact."
    else:
        severity = "NONE"
        dropout_detected = False
        desc = "No abnormal scanline dropouts or motion banding artifacts detected across the transect."

    return {
        "assessment_name": "Motion-related image artifact / dropout assessment",
        "dropout_detected": dropout_detected,
        "dropout_count": num_dropouts,
        "dropout_percentage": dropout_percentage,
        "artifact_severity": severity,
        "row_jitter_mean": round(mean_row_jitter, 2),
        "detected_artifacts": detected_artifacts,
        "description": desc,
        "disclaimer": (
            "Image-level scanline and band anomaly detection only. Physical heave, pitch, "
            "and roll compensation strictly requires external IMU / AHRS sensor telemetry."
        )
    }


def compute_evidence_and_reliability(
    yolo_confidence: float,
    speckle_metrics: Dict[str, Any],
    resolution_metrics: Dict[str, Any],
    shadow_metrics: Dict[str, Any],
    dropout_metrics: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Computes an interpretable, multi-criteria prototype AI Evidence Score (0-100) and Reliability Assessment.
    Combines real YOLO neural confidence with acoustic shadow corroboration, resolution quality, and noise penalties.
    """
    # 1. Base YOLO confidence contribution (0 to 40 pts)
    base_conf_pts = yolo_confidence * 40.0

    # 2. Acoustic shadow corroboration bonus (0 to 25 pts)
    shadow_strength = shadow_metrics.get("evidence_strength", "WEAK")
    if shadow_strength == "STRONG":
        shadow_pts = 25.0
    elif shadow_strength == "MODERATE":
        shadow_pts = 16.0
    elif shadow_strength == "WEAK":
        shadow_pts = 6.0
    else:  # ABSENT or UNAVAILABLE
        shadow_pts = 0.0

    # 3. Resolution & Image Quality bonus (0 to 20 pts)
    qual_rating = resolution_metrics.get("quality_rating", "ACCEPTABLE")
    if qual_rating == "OPTIMAL":
        qual_pts = 20.0
    elif qual_rating == "ACCEPTABLE":
        qual_pts = 13.0
    else:
        qual_pts = 5.0

    # 4. Speckle noise penalty (0 to -12 pts)
    speckle_lvl = speckle_metrics.get("speckle_level", "MODERATE")
    if speckle_lvl == "SEVERE":
        noise_penalty = 12.0
    elif speckle_lvl == "MODERATE":
        noise_penalty = 4.0
    else:
        noise_penalty = 0.0

    # 5. Motion dropout / artifact penalty (0 to -25 pts)
    artifact_sev = dropout_metrics.get("artifact_severity", "NONE")
    if artifact_sev == "SEVERE":
        dropout_penalty = 22.0
    elif artifact_sev == "MODERATE":
        dropout_penalty = 12.0
    elif artifact_sev == "LOW":
        dropout_penalty = 4.0
    else:
        dropout_penalty = 0.0

    raw_evidence = base_conf_pts + shadow_pts + qual_pts - noise_penalty - dropout_penalty
    evidence_score = int(min(98, max(8, round(raw_evidence))))

    review_reasons: List[str] = []

    if yolo_confidence < 0.45:
        review_reasons.append(f"Low neural confidence ({round(yolo_confidence * 100)}%) from YOLO detector.")

    if shadow_strength in ("WEAK", "ABSENT"):
        review_reasons.append("Low or absent acoustic shadow; object may lack 3D vertical relief or be an acoustic seabed artifact.")

    if speckle_lvl == "SEVERE":
        review_reasons.append("High acoustic speckle noise interference degrades boundary localization.")

    if artifact_sev in ("SEVERE", "MODERATE"):
        review_reasons.append(f"{artifact_sev.capitalize()} scanline dropout or banding artifacts detected in this frame.")

    if resolution_metrics.get("quality_rating") == "POOR":
        review_reasons.append("Sub-optimal image sharpness or dynamic contrast.")

    if evidence_score >= 75 and len(review_reasons) == 0:
        reliability = "HIGH"
        review_required = False
    elif evidence_score >= 52 and artifact_sev != "SEVERE":
        reliability = "MEDIUM"
        review_required = len(review_reasons) >= 2 or yolo_confidence < 0.40
    else:
        reliability = "REVIEW"
        review_required = True

    return {
        "evidence_score": evidence_score,
        "reliability": reliability,
        "review_required": review_required,
        "review_reasons": review_reasons,
        "components": {
            "yolo_confidence_contribution": round(base_conf_pts, 1),
            "shadow_evidence_contribution": shadow_pts,
            "quality_contribution": qual_pts,
            "noise_penalty": noise_penalty,
            "artifact_penalty": dropout_penalty
        }
    }


def analyze_sonar_image_quality(
    image_input: Union[bytes, Image.Image, np.ndarray],
    detections: Optional[List[Dict[str, Any]]] = None
) -> Dict[str, Any]:
    """
    Comprehensive Sonar Quality Analysis entrypoint.
    Returns:
      - speckle_noise
      - resolution_quality
      - acoustic_shadow
      - dropout_artifact
      - overall_quality
      - evidence_assessment
      - enriched_detections
    """
    gray = _to_grayscale_numpy(image_input)

    # 1. Speckle Noise
    speckle = analyze_speckle_noise(gray)

    # 2. 2D Resolution & Contrast
    resolution = analyze_resolution_quality(gray)

    # 3. Motion-related image artifact / dropout assessment
    dropout = analyze_motion_dropout(gray)

    # 4. Global Acoustic Shadow Evidence
    global_shadow = analyze_acoustic_shadow(gray, bbox=None)

    # Overall Quality
    overall_quality = {
        "composite_score": resolution["composite_score"],
        "quality_rating": resolution["quality_rating"],
        "description": resolution["description"]
    }

    # Frame-level evidence calculation
    avg_conf = 0.70
    if detections and len(detections) > 0:
        avg_conf = float(np.mean([d.get("confidence", 0.5) for d in detections]))

    overall_evidence = compute_evidence_and_reliability(
        yolo_confidence=avg_conf,
        speckle_metrics=speckle,
        resolution_metrics=resolution,
        shadow_metrics=global_shadow,
        dropout_metrics=dropout
    )

    # Per-detection shadow analysis and evidence enrichment
    enriched_detections = []
    if detections:
        for det in detections:
            bbox = det.get("bounding_box") or det.get("bbox")
            conf = float(det.get("confidence", 0.5))
            det_shadow = analyze_acoustic_shadow(gray, bbox=bbox)
            det_evidence = compute_evidence_and_reliability(
                yolo_confidence=conf,
                speckle_metrics=speckle,
                resolution_metrics=resolution,
                shadow_metrics=det_shadow,
                dropout_metrics=dropout
            )

            det_copy = dict(det)
            det_copy["acoustic_shadow"] = {
                "shadow_detected": det_shadow["shadow_detected"],
                "shadow_contrast_ratio": det_shadow["shadow_contrast_ratio"],
                "evidence_strength": det_shadow["evidence_strength"],
                "description": det_shadow["description"]
            }
            det_copy["evidence_score"] = det_evidence["evidence_score"]
            det_copy["reliability"] = det_evidence["reliability"]
            det_copy["review_required"] = det_evidence["review_required"]
            det_copy["review_reasons"] = det_evidence["review_reasons"]
            enriched_detections.append(det_copy)

    return {
        "sonar_quality": {
            "speckle_noise": {
                "speckle_index": speckle["speckle_index"],
                "speckle_level": speckle["speckle_level"],
                "enl": speckle["enl"],
                "score": speckle["score"],
                "description": speckle["description"]
            },
            "resolution_quality": {
                "width": resolution["width"],
                "height": resolution["height"],
                "sharpness_score": resolution["sharpness_score"],
                "laplacian_variance": resolution["laplacian_variance"],
                "mean_gradient": resolution["mean_gradient"],
                "contrast_score": resolution["contrast_score"],
                "dynamic_range": resolution["dynamic_range"],
                "quality_rating": resolution["quality_rating"],
                "disclaimer": resolution["disclaimer"]
            },
            "acoustic_shadow": {
                "shadow_detected": global_shadow["shadow_detected"],
                "shadow_contrast_ratio": global_shadow["shadow_contrast_ratio"],
                "evidence_strength": global_shadow["evidence_strength"],
                "description": global_shadow["description"],
                "methodology": global_shadow["methodology"]
            },
            "dropout_artifact": {
                "assessment_name": dropout["assessment_name"],
                "dropout_detected": dropout["dropout_detected"],
                "dropout_count": dropout["dropout_count"],
                "dropout_percentage": dropout["dropout_percentage"],
                "artifact_severity": dropout["artifact_severity"],
                "row_jitter_mean": dropout["row_jitter_mean"],
                "detected_artifacts": dropout["detected_artifacts"],
                "description": dropout["description"],
                "disclaimer": dropout["disclaimer"]
            },
            "overall_quality": overall_quality
        },
        "evidence_assessment": {
            "evidence_score": overall_evidence["evidence_score"],
            "reliability": overall_evidence["reliability"],
            "review_required": overall_evidence["review_required"],
            "review_reasons": overall_evidence["review_reasons"],
            "components": overall_evidence["components"]
        },
        "enriched_detections": enriched_detections
    }
