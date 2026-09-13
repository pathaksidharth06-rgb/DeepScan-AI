# DeepScan AI — Underwater Sonar Intelligence Platform

AI-powered underwater marine debris and anomaly detection system using Side-Scan Sonar imagery — SIH26057

Autonomous Side-Scan Sonar (SSS) Threat Classification & Decision Support System.

## Overview
DeepScan AI upgrades a standard YOLO11n object detection model into a full-cycle hydrographic decision-support platform. It processes side-scan sonar images, classifies 11 target categories (including ghost fishing gear, shipwrecks, and subsea pipelines), computes heuristic ecological hazard scores, powers a Human-in-the-Loop (HITL) audit ledger, and automatically generates certified PDF survey packages.

---

## Key Features

1. **Split-Pane Command Center UI (1:1 Exact Match)**
   - Left Panel: Upload with topographic bathymetric contours, sample presets, file metadata, and signature bronze **"Detect Objects ✨"** gradient button.
   - Right Panel: Sonar Intelligence output with YOLO11n stats, interactive semicircular **Priority Score Speedometer Gauge**, pixel dimensions, eco-impact rating, bounding boxes, and **Verify / Reject** feedback controls.
2. **Acoustic Sonar Sweep Animation**
   - High-fidelity radar/beamforming sweep animation across the acoustic sonar canvas during analysis.
3. **11-Class Sonar Taxonomy & Rule-Based Intelligence Engine**
   - *Marine Debris / Anthropogenic*: Fishing Net, Crab Pot, Shipwreck, Pipe, Rope, Tire, Weight, Block, Artificial Reef, Pipeline/Cylinder
   - *Natural Object*: Boulder
   - *Anomaly (OOD)*: Unknown Anomaly
4. **Human-in-the-Loop (HITL) Retraining Loop**
   - Verify or reject predictions directly in the UI.
   - All reviews are stored in local persistence and can be exported as a curated dataset (`.json`) for future model fine-tuning.
5. **Batch Survey Mission Mode**
   - Process multiple sonar transect frames simultaneously with aggregate risk summaries and threat counters.
6. **Automated PDF Survey Report Generator**
   - 1-click generation of structured, professional maritime survey reports with embedded sonar imagery, contact breakdown, and inspector signature block.
7. **Interactive Analytics & Audit History**
   - Recharts powered dashboards for class frequency, threat levels, and verification accuracy.

---

## Quick Start (Frontend)

```bash
# 1. Navigate to the project directory
cd deepscan-ai

# 2. Run the Vite development server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Backend (FastAPI - Optional)

```bash
cd backend
pip install -r requirements.txt
python main.py
```
Backend runs at `http://localhost:8000` with Swagger docs at `http://localhost:8000/docs`.

---

## Technology Stack
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Recharts, jsPDF, Canvas-Confetti
- **Backend**: FastAPI, Uvicorn, SQLite, Python 3.13
- **Deep Learning**: YOLO11n SSS Detection Pipeline
