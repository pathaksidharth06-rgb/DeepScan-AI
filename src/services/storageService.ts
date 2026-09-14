import type { SonarScan } from '../types/sonar';

const BACKEND_URL = 'https://deepscan-ai-tyvx.onrender.com';
const SCANS_STORAGE_KEY = 'deepscan_scans_history';
const FEEDBACK_STORAGE_KEY = 'deepscan_hitl_feedback';

export interface HITLFeedbackRecord {
  id: string;
  scanId: string;
  detectionId: string;
  originalClass: string;
  verifiedClass: string;
  confidence: number;
  status: 'verified' | 'rejected';
  operatorRole: string;
  notes?: string;
  timestamp: string;
}

const isMockScan = (s: SonarScan): boolean => {
  if (!s || !s.id) return true;
  if (s.isSample) return true;

  if (
    s.id.startsWith('scan-shipwreck') ||
    s.id.startsWith('scan-net') ||
    s.id.startsWith('scan-pipeline') ||
    s.id.startsWith('scan-tire') ||
    s.id.startsWith('scan-boulder') ||
    s.id.startsWith('preset-')
  ) {
    return true;
  }

  if (
    s.filename === 'OIP.webp' ||
    s.filename === 'ghost_net_grid_B.png' ||
    s.filename === 'subsea_pipeline_4k.webp' ||
    s.filename === 'debris_tire_reef.jpg' ||
    s.filename === 'seabed_boulder_scan.png'
  ) {
    return true;
  }

  return false;
};

export const storageService = {
  // ------------------------------------------------------------
  // LOCAL HISTORY
  // ------------------------------------------------------------
  getStoredScans(): SonarScan[] {
    try {
      const data = localStorage.getItem(SCANS_STORAGE_KEY);
      if (!data) return [];

      const parsed: SonarScan[] = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];

      const clean = parsed.filter((s) => !isMockScan(s));

      if (clean.length !== parsed.length) {
        localStorage.setItem(
          SCANS_STORAGE_KEY,
          JSON.stringify(clean)
        );
      }

      return clean;
    } catch (e) {
      console.warn('Could not read local scan history', e);
      return [];
    }
  },

  // ------------------------------------------------------------
  // BACKEND HISTORY
  // ------------------------------------------------------------
  async fetchBackendScans(): Promise<SonarScan[]> {
    try {
      const res = await fetch(
        `${BACKEND_URL}/scans?limit=200`,
        {
          method: 'GET',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
          },
        }
      );

      if (!res.ok) {
        console.warn(
          `Backend scans request failed: ${res.status}`
        );
        return [];
      }

      const data = await res.json();

      // Current FastAPI backend returns a bare array.
      // Also support { scans: [...] } for compatibility.
      const scans = Array.isArray(data)
        ? data
        : Array.isArray(data?.scans)
          ? data.scans
          : [];

      return scans.filter(
        (scan: SonarScan) => !isMockScan(scan)
      );
    } catch (e) {
      console.warn(
        'Backend scans fetch failed:',
        e
      );
      return [];
    }
  },

  // ------------------------------------------------------------
  // SAVE SCAN
  // ------------------------------------------------------------
  saveScan(scan: SonarScan): void {
    try {
      const scans = this.getStoredScans();

      // Do not store huge base64 images in localStorage.
      // The backend now provides permanent-in-session Render URLs.
      const lightScan: SonarScan = {
        ...scan,

        imageUrl:
          scan.imageUrl?.startsWith('data:')
            ? (
                scan.id
                  ? `${BACKEND_URL}/outputs/${scan.id}.jpg`
                  : ''
              )
            : scan.imageUrl,

        annotatedImageUrl:
          scan.annotatedImageUrl?.startsWith('data:')
            ? (
                scan.id
                  ? `${BACKEND_URL}/outputs/${scan.id}_annotated.jpg`
                  : ''
              )
            : scan.annotatedImageUrl,

        // Remove heavy fields from localStorage.
        imageBase64: undefined,
        annotatedBase64: undefined,
      };

      const existingIndex = scans.findIndex(
        (s) => s.id === scan.id
      );

      if (existingIndex >= 0) {
        scans[existingIndex] = lightScan;
      } else {
        scans.unshift(lightScan);
      }

      localStorage.setItem(
        SCANS_STORAGE_KEY,
        JSON.stringify(scans.slice(0, 100))
      );
    } catch (e) {
      console.error(
        'Error saving scan to local storage',
        e
      );
    }
  },

  // ------------------------------------------------------------
  // DELETE ONE SCAN
  // ------------------------------------------------------------
  async deleteScan(scanId: string): Promise<void> {
    try {
      const res = await fetch(
        `${BACKEND_URL}/scans/${encodeURIComponent(scanId)}`,
        {
          method: 'DELETE',
        }
      );

      if (!res.ok) {
        console.warn(
          `Backend scan deletion failed: ${res.status}`
        );
      }
    } catch (e) {
      console.warn(
        'Backend scan deletion failed:',
        e
      );
    }

    try {
      const scans = this.getStoredScans();

      const updated = scans.filter(
        (s) => s.id !== scanId
      );

      localStorage.setItem(
        SCANS_STORAGE_KEY,
        JSON.stringify(updated)
      );
    } catch (e) {
      console.error(
        'Error updating local storage after delete',
        e
      );
    }
  },

  // ------------------------------------------------------------
  // DELETE ALL SCANS
  // ------------------------------------------------------------
  async clearAllScans(): Promise<void> {
    try {
      const res = await fetch(
        `${BACKEND_URL}/scans`,
        {
          method: 'DELETE',
        }
      );

      if (!res.ok) {
        console.warn(
          `Backend clear all scans failed: ${res.status}`
        );
      }
    } catch (e) {
      console.warn(
        'Backend clear all scans failed:',
        e
      );
    }

    try {
      localStorage.removeItem(
        SCANS_STORAGE_KEY
      );
    } catch (e) {
      console.error(
        'Error clearing local storage',
        e
      );
    }
  },

  // ------------------------------------------------------------
  // HITL REVIEW
  // ------------------------------------------------------------
  updateDetectionReview(
    scanId: string,
    detectionId: string,
    status: 'verified' | 'rejected',
    notes?: string
  ): void {
    const scans = this.getStoredScans();

    const scan = scans.find(
      (s) => s.id === scanId
    );

    if (!scan) return;

    const detection = scan.detections.find(
      (d) => d.id === detectionId
    );

    if (!detection) return;

    detection.verificationStatus = status;

    if (notes) {
      detection.notes = notes;
    }

    this.saveScan(scan);

    this.recordFeedback({
      id: `hitl-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 5)}`,

      scanId,

      detectionId,

      originalClass:
        detection.className,

      verifiedClass:
        detection.correctedLabel ||
        detection.className,

      confidence:
        detection.confidence,

      status,

      operatorRole:
        'Hydrographic Operator',

      notes,

      timestamp:
        new Date().toISOString(),
    });
  },

  // ------------------------------------------------------------
  // FEEDBACK
  // ------------------------------------------------------------
  recordFeedback(
    record: HITLFeedbackRecord
  ): void {
    try {
      const existing =
        this.getFeedbackHistory();

      existing.unshift(record);

      localStorage.setItem(
        FEEDBACK_STORAGE_KEY,
        JSON.stringify(
          existing.slice(0, 500)
        )
      );
    } catch (e) {
      console.error(
        'Error logging HITL feedback',
        e
      );
    }
  },

  getFeedbackHistory(): HITLFeedbackRecord[] {
    try {
      const data =
        localStorage.getItem(
          FEEDBACK_STORAGE_KEY
        );

      if (!data) return [];

      const parsed = JSON.parse(data);

      return Array.isArray(parsed)
        ? parsed
        : [];
    } catch {
      return [];
    }
  },

  // ------------------------------------------------------------
  // EXPORT HITL DATA
  // ------------------------------------------------------------
  exportRetrainingData(): void {
    const feedback =
      this.getFeedbackHistory();

    const blob = new Blob(
      [
        JSON.stringify(
          feedback,
          null,
          2
        ),
      ],
      {
        type: 'application/json',
      }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement('a');

    a.href = url;

    a.download =
      `deepscan-hitl-curated-dataset-${
        new Date()
          .toISOString()
          .split('T')[0]
      }.json`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  },
};
