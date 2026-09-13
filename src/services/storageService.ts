import type { SonarScan } from '../types/sonar';

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

export const storageService = {
  getStoredScans(): SonarScan[] {
    try {
      const data = localStorage.getItem(SCANS_STORAGE_KEY);
      if (!data) return [];
      const parsed: SonarScan[] = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];

      // Filter out any mock/sample scans
      const clean = parsed.filter((s) => {
        if (!s || !s.id) return false;
        if (s.isSample) return false;
        if (
          s.id.startsWith('scan-shipwreck') ||
          s.id.startsWith('scan-net') ||
          s.id.startsWith('scan-pipeline') ||
          s.id.startsWith('scan-tire') ||
          s.id.startsWith('scan-boulder') ||
          s.id.startsWith('preset-')
        ) return false;
        if (
          s.filename === 'OIP.webp' ||
          s.filename === 'ghost_net_grid_B.png' ||
          s.filename === 'subsea_pipeline_4k.webp' ||
          s.filename === 'debris_tire_reef.jpg' ||
          s.filename === 'seabed_boulder_scan.png'
        ) return false;
        return true;
      });

      if (clean.length !== parsed.length) {
        localStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(clean));
      }

      return clean;
    } catch {
      return [];
    }
  },

  async fetchBackendScans(): Promise<SonarScan[]> {
    try {
      const res = await fetch('http://localhost:8000/scans?limit=200');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.scans)) {
          return data.scans;
        }
      }
    } catch (e) {
      console.warn('Backend scans fetch failed', e);
    }
    return [];
  },

  saveScan(scan: SonarScan): void {
    try {
      const scans = this.getStoredScans();
      // Strip heavy base64 data URIs so localStorage quota (5MB) is never exceeded!
      const lightScan: SonarScan = {
        ...scan,
        imageUrl: scan.imageUrl?.startsWith('data:')
          ? (scan.id ? `http://localhost:8000/outputs/${scan.id}.jpg` : '')
          : scan.imageUrl,
        annotatedImageUrl: scan.annotatedImageUrl?.startsWith('data:')
          ? (scan.id ? `http://localhost:8000/outputs/${scan.id}_annotated.jpg` : '')
          : scan.annotatedImageUrl,
      };

      const existingIndex = scans.findIndex((s) => s.id === scan.id);
      if (existingIndex >= 0) {
        scans[existingIndex] = lightScan;
      } else {
        scans.unshift(lightScan);
      }
      localStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(scans.slice(0, 100)));
    } catch (e) {
      console.error('Error saving scan to local storage', e);
    }
  },

  async deleteScan(scanId: string): Promise<void> {
    try {
      await fetch(`http://localhost:8000/scans/${scanId}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Backend scan deletion failed', e);
    }

    try {
      const scans = this.getStoredScans();
      const updated = scans.filter((s) => s.id !== scanId);
      localStorage.setItem(SCANS_STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error updating local storage after delete', e);
    }
  },

  async clearAllScans(): Promise<void> {
    try {
      await fetch('http://localhost:8000/scans', { method: 'DELETE' });
    } catch (e) {
      console.warn('Backend clear all scans failed', e);
    }

    try {
      localStorage.removeItem(SCANS_STORAGE_KEY);
    } catch (e) {
      console.error('Error clearing local storage', e);
    }
  },

  updateDetectionReview(
    scanId: string,
    detectionId: string,
    status: 'verified' | 'rejected',
    notes?: string
  ): void {
    const scans = this.getStoredScans();
    const scan = scans.find((s) => s.id === scanId);
    if (scan) {
      const detection = scan.detections.find((d) => d.id === detectionId);
      if (detection) {
        detection.verificationStatus = status;
        if (notes) detection.notes = notes;
        this.saveScan(scan);

        this.recordFeedback({
          id: `hitl-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          scanId,
          detectionId,
          originalClass: detection.className,
          verifiedClass: detection.correctedLabel || detection.className,
          confidence: detection.confidence,
          status,
          operatorRole: 'Hydrographic Operator',
          notes,
          timestamp: new Date().toISOString(),
        });
      }
    }
  },

  recordFeedback(record: HITLFeedbackRecord): void {
    try {
      const existing = this.getFeedbackHistory();
      existing.unshift(record);
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(existing.slice(0, 500)));
    } catch (e) {
      console.error('Error logging HITL feedback', e);
    }
  },

  getFeedbackHistory(): HITLFeedbackRecord[] {
    try {
      const data = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  exportRetrainingData(): void {
    const feedback = this.getFeedbackHistory();
    const blob = new Blob([JSON.stringify(feedback, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deepscan-hitl-curated-dataset-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
