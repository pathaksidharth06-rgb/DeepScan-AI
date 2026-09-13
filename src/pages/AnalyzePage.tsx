import React, { useState, useEffect } from 'react';
import { ScanInputPanel } from '../components/ScanInputPanel';
import { IntelligenceCard } from '../components/IntelligenceCard';
import { FeatureHighlights } from '../components/FeatureHighlights';
import type { SonarScan } from '../types/sonar';
import { storageService } from '../services/storageService';
import { generateSurveyPdfReport } from '../services/pdfReportGenerator';

const BACKEND_URL = 'http://localhost:8000';

export const AnalyzePage: React.FC = () => {
  // 100% Clean initial state: NO fake shipwreck and NO pre-selected photo!
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedScan, setSelectedScan] = useState<SonarScan | null>(null);
  const [activeResultsScan, setActiveResultsScan] = useState<SonarScan | null>(null);
  const [batchScans, setBatchScans] = useState<SonarScan[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(0);

  const [isScanning, setIsScanning] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);

  // Check if FastAPI best.pt backend is active
  useEffect(() => {
    fetch(`${BACKEND_URL}/health`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ONLINE' || data.status === 'healthy') {
          setBackendOnline(true);
        }
      })
      .catch(() => {
        setBackendOnline(false);
      });
  }, []);

  const handleFilesSelected = (files: File[]) => {
    setUploadedFiles(files);
    setActiveResultsScan(null);
    setBatchScans([]);
    setCurrentBatchIndex(0);

    // If 1 file selected, read its preview
    if (files.length === 1) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const previewUrl = e.target?.result as string;
        setSelectedScan({
          id: `preview-${Date.now()}`,
          filename: file.name,
          fileSizeMB: Math.round((file.size / (1024 * 1024)) * 100) / 100 || 0.01,
          resolution: { width: 1024, height: 800 },
          imageUrl: previewUrl,
          detections: [],
          processedAt: new Date().toISOString(),
          processingTimeMs: 0,
          modelVersion: 'YOLO11n (best.pt)',
        });
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedScan(null);
    }
  };

  const handleRemoveFile = (index: number) => {
    const updated = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(updated);
    if (updated.length === 0) {
      setSelectedScan(null);
      setActiveResultsScan(null);
      setBatchScans([]);
    } else if (updated.length === 1) {
      handleFilesSelected(updated);
    }
  };

  const handleClear = () => {
    setUploadedFiles([]);
    setSelectedScan(null);
    setActiveResultsScan(null);
    setBatchScans([]);
    setCurrentBatchIndex(0);
  };

  const handleDetect = async () => {
    if (uploadedFiles.length === 0 && !selectedScan) return;

    setIsScanning(true);

    // 1. Single Image Detection via real best.pt backend
    if (uploadedFiles.length === 1 && backendOnline) {
      try {
        const formData = new FormData();
        formData.append('file', uploadedFiles[0]);

        const response = await fetch(`${BACKEND_URL}/predict`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const liveData: SonarScan = await response.json();
          setIsScanning(false);
          setActiveResultsScan(liveData);
          setBatchScans([liveData]);
          setCurrentBatchIndex(0);
          storageService.saveScan(liveData);
          return;
        }
      } catch (err) {
        console.warn('Backend inference failed, falling back', err);
      }
    }

    // 2. Batch Images Detection via real best.pt backend (/predict-batch)
    if (uploadedFiles.length > 1 && backendOnline) {
      try {
        const formData = new FormData();
        uploadedFiles.forEach((file) => {
          formData.append('files', file);
        });

        const response = await fetch(`${BACKEND_URL}/predict-batch`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const liveBatch: SonarScan[] = await response.json();
          setIsScanning(false);
          setBatchScans(liveBatch);
          setCurrentBatchIndex(0);
          setActiveResultsScan(liveBatch[0]);
          liveBatch.forEach((scan) => storageService.saveScan(scan));
          return;
        }
      } catch (err) {
        console.warn('Batch inference failed', err);
      }
    }

    // 3. Clean completion if backend was unavailable
    setIsScanning(false);
    if (!backendOnline) {
      alert("DeepScan AI Backend is offline or unreachable on http://localhost:8000. Please start the backend to run live inference.");
    }
  };

  const handleSelectBatchIndex = (idx: number) => {
    setCurrentBatchIndex(idx);
    if (batchScans[idx]) {
      setActiveResultsScan(batchScans[idx]);
    }
  };

  const handleVerify = (detectionId: string) => {
    if (!activeResultsScan) return;
    storageService.updateDetectionReview(activeResultsScan.id, detectionId, 'verified');
    const updated = { ...activeResultsScan };
    const det = updated.detections.find((d) => d.id === detectionId);
    if (det) det.verificationStatus = 'verified';
    setActiveResultsScan(updated);
  };

  const handleReject = (detectionId: string) => {
    if (!activeResultsScan) return;
    storageService.updateDetectionReview(activeResultsScan.id, detectionId, 'rejected');
    const updated = { ...activeResultsScan };
    const det = updated.detections.find((d) => d.id === detectionId);
    if (det) det.verificationStatus = 'rejected';
    setActiveResultsScan(updated);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-5 h-full">
          <ScanInputPanel
            uploadedFiles={uploadedFiles}
            selectedScan={selectedScan}
            onFilesSelected={handleFilesSelected}
            onRemoveFile={handleRemoveFile}
            onClear={handleClear}
            onDetect={handleDetect}
            isScanning={isScanning}
          />
        </div>

        <div className="lg:col-span-7 h-full">
          <IntelligenceCard
            scan={activeResultsScan}
            batchScans={batchScans}
            currentBatchIndex={currentBatchIndex}
            onSelectBatchIndex={handleSelectBatchIndex}
            isScanning={isScanning}
            onVerify={handleVerify}
            onReject={handleReject}
            onDownloadReport={(scan) => generateSurveyPdfReport(scan)}
          />
        </div>
      </div>

      <FeatureHighlights />
    </div>
  );
};
