import React, { useState, useEffect } from 'react';
import { ScanInputPanel } from '../components/ScanInputPanel';
import { IntelligenceCard } from '../components/IntelligenceCard';
import { FeatureHighlights } from '../components/FeatureHighlights';
import type { SonarScan } from '../types/sonar';
import { storageService } from '../services/storageService';
import { generateSurveyPdfReport } from '../services/pdfReportGenerator';

const BACKEND_URL = 'https://deepscan-ai-tyvx.onrender.com';

export const AnalyzePage: React.FC = () => {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [selectedScan, setSelectedScan] = useState<SonarScan | null>(null);
  const [activeResultsScan, setActiveResultsScan] = useState<SonarScan | null>(null);
  const [batchScans, setBatchScans] = useState<SonarScan[]>([]);
  const [currentBatchIndex, setCurrentBatchIndex] = useState<number>(0);

  const [isScanning, setIsScanning] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);

  // Check Render FastAPI backend
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/health`, {
          method: 'GET',
        });

        if (!response.ok) {
          setBackendOnline(false);
          return;
        }

        const data = await response.json();

        if (
          data.status === 'ONLINE' ||
          data.status === 'healthy' ||
          data.status === 'online'
        ) {
          setBackendOnline(true);
        } else {
          setBackendOnline(false);
        }
      } catch (error) {
        console.warn('Backend health check failed:', error);
        setBackendOnline(false);
      }
    };

    checkBackend();
  }, []);

  const handleFilesSelected = (files: File[]) => {
    setUploadedFiles(files);
    setActiveResultsScan(null);
    setBatchScans([]);
    setCurrentBatchIndex(0);

    // Preview single image
    if (files.length === 1) {
      const file = files[0];
      const reader = new FileReader();

      reader.onload = (e) => {
        const previewUrl = e.target?.result as string;

        setSelectedScan({
          id: `preview-${Date.now()}`,
          filename: file.name,
          fileSizeMB:
            Math.round((file.size / (1024 * 1024)) * 100) / 100 || 0.01,
          resolution: {
            width: 1024,
            height: 800,
          },
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
      setCurrentBatchIndex(0);
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

  // Wake/check backend before inference
  const checkBackendBeforeInference = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`, {
        method: 'GET',
      });

      if (!response.ok) {
        setBackendOnline(false);
        return false;
      }

      const data = await response.json();

      const online =
        data.status === 'ONLINE' ||
        data.status === 'healthy' ||
        data.status === 'online';

      setBackendOnline(online);

      return online;
    } catch (error) {
      console.warn('Unable to reach Render backend:', error);
      setBackendOnline(false);
      return false;
    }
  };

  const handleDetect = async () => {
    if (uploadedFiles.length === 0) {
      alert('Please upload at least one sonar image first.');
      return;
    }

    setIsScanning(true);

    try {
      // Check/wake Render backend
      const isBackendReady = await checkBackendBeforeInference();

      if (!isBackendReady) {
        setIsScanning(false);

        alert(
          'DeepScan AI backend is currently unavailable. Render may be waking up. Please wait about 30–60 seconds and try again.'
        );

        return;
      }

      // ---------------------------------------------------------
      // 1. SINGLE IMAGE DETECTION
      // ---------------------------------------------------------
      if (uploadedFiles.length === 1) {
        const formData = new FormData();

        formData.append('file', uploadedFiles[0]);

        console.log('Sending image to DeepScan AI backend...');

        const response = await fetch(`${BACKEND_URL}/predict`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();

          console.error(
            'Prediction failed:',
            response.status,
            errorText
          );

          throw new Error(
            `Backend returned ${response.status}: ${errorText}`
          );
        }

        const liveData: SonarScan = await response.json();

        console.log('Prediction successful:', liveData);

        setActiveResultsScan(liveData);
        setBatchScans([liveData]);
        setCurrentBatchIndex(0);

        storageService.saveScan(liveData);

        setIsScanning(false);

        return;
      }

      // ---------------------------------------------------------
      // 2. BATCH IMAGE DETECTION
      // ---------------------------------------------------------
      if (uploadedFiles.length > 1) {
        const formData = new FormData();

        uploadedFiles.forEach((file) => {
          formData.append('files', file);
        });

        console.log(
          `Sending ${uploadedFiles.length} images for batch detection...`
        );

        const response = await fetch(`${BACKEND_URL}/predict-batch`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();

          console.error(
            'Batch prediction failed:',
            response.status,
            errorText
          );

          throw new Error(
            `Backend returned ${response.status}: ${errorText}`
          );
        }

        const liveBatch: SonarScan[] = await response.json();

        console.log(
          'Batch prediction successful:',
          liveBatch
        );

        setBatchScans(liveBatch);
        setCurrentBatchIndex(0);
        setActiveResultsScan(liveBatch[0] || null);

        liveBatch.forEach((scan) => {
          storageService.saveScan(scan);
        });

        setIsScanning(false);

        return;
      }
    } catch (error) {
      console.error('DeepScan AI inference error:', error);

      setIsScanning(false);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unknown backend error';

      alert(
        `DeepScan AI inference failed.\n\n${errorMessage}\n\nPlease try again after a few seconds.`
      );
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

    storageService.updateDetectionReview(
      activeResultsScan.id,
      detectionId,
      'verified'
    );

    const updated = { ...activeResultsScan };

    const det = updated.detections.find(
      (d) => d.id === detectionId
    );

    if (det) {
      det.verificationStatus = 'verified';
    }

    setActiveResultsScan(updated);
  };

  const handleReject = (detectionId: string) => {
    if (!activeResultsScan) return;

    storageService.updateDetectionReview(
      activeResultsScan.id,
      detectionId,
      'rejected'
    );

    const updated = { ...activeResultsScan };

    const det = updated.detections.find(
      (d) => d.id === detectionId
    );

    if (det) {
      det.verificationStatus = 'rejected';
    }

    setActiveResultsScan(updated);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

        {/* Scan Input */}
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

        {/* AI Results */}
        <div className="lg:col-span-7 h-full">
          <IntelligenceCard
            scan={activeResultsScan}
            batchScans={batchScans}
            currentBatchIndex={currentBatchIndex}
            onSelectBatchIndex={handleSelectBatchIndex}
            isScanning={isScanning}
            onVerify={handleVerify}
            onReject={handleReject}
            onDownloadReport={(scan) =>
              generateSurveyPdfReport(scan)
            }
          />
        </div>
      </div>

      <FeatureHighlights />
    </div>
  );
};
