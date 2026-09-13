import React, { useState } from 'react';
import {
  Brain,
  Target,
  Cpu,
  Image as ImageIcon,
  Check,
  Bookmark,
  ChevronDown,
  FileDown,
  Box,
  FileText,
  Ship,
  Fish,
  AlertTriangle,
  Compass,
  CheckCircle2,
  XCircle,
  CheckCircle,
  Waves,
  Activity,
  Eye,
  Sliders,
  ShieldAlert,
  ShieldCheck,
  Info,
} from 'lucide-react';
import type { SonarScan } from '../types/sonar';
import { SpeedometerGauge } from './SpeedometerGauge';
import { SonarCanvas } from './SonarCanvas';
import confetti from 'canvas-confetti';

interface IntelligenceCardProps {
  scan: SonarScan | null;
  batchScans?: SonarScan[];
  currentBatchIndex?: number;
  onSelectBatchIndex?: (idx: number) => void;
  isScanning: boolean;
  onVerify: (detectionId: string) => void;
  onReject: (detectionId: string) => void;
  onDownloadReport: (scan: SonarScan) => void;
}

export const IntelligenceCard: React.FC<IntelligenceCardProps> = ({
  scan,
  batchScans = [],
  currentBatchIndex = 0,
  onSelectBatchIndex,
  onVerify,
  onReject,
  onDownloadReport,
}) => {
  const [sortBy, setSortBy] = useState<'confidence' | 'priority' | 'size'>('confidence');
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>({});

  const toggleBookmark = (id: string) => {
    setBookmarkedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleVerify = (id: string) => {
    onVerify(id);
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#d97706', '#b45309', '#78350f', '#f59e0b'],
    });
  };

  const detections = scan?.detections || [];

  const sortedDetections = [...detections].sort((a, b) => {
    if (sortBy === 'confidence') return b.confidence - a.confidence;
    if (sortBy === 'priority') return b.priorityScore - a.priorityScore;
    if (sortBy === 'size') {
      const areaA = a.pixelDimensions.width * a.pixelDimensions.height;
      const areaB = b.pixelDimensions.width * b.pixelDimensions.height;
      return areaB - areaA;
    }
    return 0;
  });

  const getObjectIcon = (className: string) => {
    switch (className) {
      case 'Shipwreck':
        return <Ship className="w-5 h-5 text-amber-700" />;
      case 'Fishing Net':
      case 'Crab Pot':
        return <Fish className="w-5 h-5 text-amber-600" />;
      case 'Pipeline/Cylinder':
      case 'Pipe':
        return <Compass className="w-5 h-5 text-stone-700" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-slate-600" />;
    }
  };

  const totalBatchDetections = batchScans.reduce((acc, s) => acc + s.detections.length, 0);

  // Normalize sonar quality data from camelCase or snake_case
  const sq = scan?.sonarQuality || (scan as any)?.sonar_quality;
  const ea = scan?.evidenceAssessment || (scan as any)?.evidence_assessment;

  const sp = sq?.speckleNoise || sq?.speckle_noise;
  const rq = sq?.resolutionQuality || sq?.resolution_quality;
  const ash = sq?.acousticShadow || sq?.acoustic_shadow;
  const doArt = sq?.motionDropout || sq?.dropout_artifact;

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 shadow-md flex flex-col justify-between h-full">
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shadow-2xs border border-slate-200/60">
              <Brain className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                AI OUTPUT
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Sonar Intelligence
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold shadow-2xs">
            <Target className="w-3.5 h-3.5 text-amber-700" />
            <span>
              {batchScans.length > 1
                ? `Frame: ${detections.length} Target${detections.length === 1 ? '' : 's'} | Batch: ${totalBatchDetections} Total`
                : scan
                ? `${detections.length} ${detections.length === 1 ? 'Target Found' : 'Targets Found'}`
                : 'Ready'}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-5 leading-relaxed">
          Detected objects, classifications and actionable insights from your sonar data.
        </p>

        {/* 3 Stat KPI Cards in a row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  IMAGES
                </div>
                <div className="text-lg font-bold text-slate-800 leading-tight">
                  {batchScans.length > 0 ? batchScans.length : scan ? '1' : '0'}
                </div>
                <div className="text-[11px] text-slate-500">Processed</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <Target className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  TOTAL TARGETS
                </div>
                <div className="text-lg font-bold text-slate-800 leading-tight">
                  {batchScans.length > 0 ? totalBatchDetections : detections.length}
                </div>
                <div className="text-[11px] text-slate-500">
                  {batchScans.length > 1 ? `Found in ${batchScans.length} images` : 'Objects found'}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600">
                <Cpu className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  MODEL
                </div>
                <div className="text-sm font-bold text-slate-800 leading-tight">
                  YOLO11n
                </div>
                <div className="text-[11px] text-amber-700 font-semibold">best.pt active</div>
              </div>
            </div>
          </div>
        </div>

        {/* Sonar Quality Analyzer Section (Classical CV Analysis) */}
        {scan && sq && (
          <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200/90 shadow-xs mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-4 bg-amber-600 rounded-full" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Acoustic Sonar Quality Analysis
                </span>
              </div>
              {ea && (
                <div
                  className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border shadow-2xs ${
                    (ea.reliability || ea.reliability_level) === 'HIGH'
                      ? 'bg-stone-100 text-stone-800 border-stone-300'
                      : 'bg-amber-50 text-amber-800 border-amber-300'
                  }`}
                >
                  {(ea.reliability || ea.reliability_level) === 'HIGH' ? (
                    <ShieldCheck className="w-3.5 h-3.5 text-stone-700" />
                  ) : (
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span>
                    Evidence: {ea.evidenceScore ?? ea.evidence_score}/100 ({ea.reliability || ea.reliability_level})
                  </span>
                </div>
              )}
            </div>

            {/* 4 Quality Conditions Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
              {/* Condition 1: Speckle Noise */}
              <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Waves className="w-3 h-3 text-amber-700" />
                    Speckle Noise
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                      (sp?.speckleLevel || sp?.speckle_level) === 'LOW'
                        ? 'bg-stone-100 text-stone-800'
                        : (sp?.speckleLevel || sp?.speckle_level) === 'MODERATE'
                        ? 'bg-amber-100 text-amber-900'
                        : (sp?.speckleLevel || sp?.speckle_level) === 'SEVERE'
                        ? 'bg-amber-200 text-amber-950'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {sp?.speckleLevel || sp?.speckle_level || 'UNAVAILABLE'}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">
                  Cv: {sp?.speckleIndex !== undefined ? Number(sp.speckleIndex).toFixed(2) : sp?.speckle_index !== undefined ? Number(sp.speckle_index).toFixed(2) : 'N/A'}
                </div>
                <div className="text-[10px] text-slate-500 truncate" title={sp?.description}>
                  ENL: {sp?.enl !== undefined ? Number(sp.enl).toFixed(1) : 'N/A'} looks
                </div>
              </div>

              {/* Condition 2: Resolution & Contrast */}
              <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Sliders className="w-3 h-3 text-amber-700" />
                    2D Sharpness
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                      (rq?.qualityRating || rq?.quality_rating) === 'OPTIMAL'
                        ? 'bg-stone-100 text-stone-800'
                        : (rq?.qualityRating || rq?.quality_rating) === 'ACCEPTABLE'
                        ? 'bg-amber-100 text-amber-900'
                        : (rq?.qualityRating || rq?.quality_rating) === 'POOR'
                        ? 'bg-amber-200 text-amber-950'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {rq?.qualityRating || rq?.quality_rating || 'UNAVAILABLE'}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {rq?.sharpnessScore ?? rq?.sharpness_score ?? 'N/A'}/100 Sharp
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  Contrast: {rq?.contrastScore ?? rq?.contrast_score ?? 'N/A'}/100
                </div>
              </div>

              {/* Condition 3: Acoustic Shadow */}
              <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Eye className="w-3 h-3 text-amber-700" />
                    Shadow Relief
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                      (ash?.evidenceStrength || ash?.evidence_strength) === 'STRONG'
                        ? 'bg-stone-100 text-stone-800'
                        : (ash?.evidenceStrength || ash?.evidence_strength) === 'MODERATE'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {ash?.evidenceStrength || ash?.evidence_strength || 'UNAVAILABLE'}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {ash?.shadowContrastRatio !== undefined
                    ? `${Number(ash.shadowContrastRatio).toFixed(2)}x`
                    : ash?.shadow_contrast_ratio !== undefined
                    ? `${Number(ash.shadow_contrast_ratio).toFixed(2)}x`
                    : 'N/A'}{' '}
                  Contrast
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  3D relief support
                </div>
              </div>

              {/* Condition 4: Motion & Dropout */}
              <div className="bg-white rounded-xl p-2.5 border border-slate-200/80 shadow-2xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Activity className="w-3 h-3 text-amber-700" />
                    Scanline Ping
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.2 rounded-md ${
                      (doArt?.artifactSeverity || doArt?.artifact_severity) === 'NONE'
                        ? 'bg-stone-100 text-stone-800'
                        : (doArt?.artifactSeverity || doArt?.artifact_severity) === 'LOW'
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-amber-200 text-amber-950'
                    }`}
                  >
                    {doArt?.artifactSeverity || doArt?.artifact_severity || 'UNAVAILABLE'}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {doArt?.dropoutCount ?? doArt?.dropout_count ?? 0} dropouts
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {doArt?.dropoutPercentage ?? doArt?.dropout_percentage ?? 0.0}% missing pings
                </div>
              </div>
            </div>

            {/* Hydrographic Technical Rule / Disclaimer */}
            <div className="flex items-start gap-2 bg-slate-100/80 rounded-xl p-2 text-[11px] text-slate-600 border border-slate-200/60">
              <Info className="w-3.5 h-3.5 text-amber-700 mt-0.5 shrink-0" />
              <span className="leading-snug">
                <strong>Hydrographic Notice:</strong> 2D image analysis measures pixel-level features and scanline integrity only. Does <strong>NOT</strong> claim to measure physical towfish heave, pitch, or roll without external IMU / AHRS sensor telemetry.
              </span>
            </div>
          </div>
        )}

        {/* Batch Image Selector (if multiple images were processed in batch) */}
        {batchScans.length > 1 && onSelectBatchIndex && (
          <div className="mb-4 bg-slate-50/80 rounded-2xl p-3 border border-slate-200/80">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700 mb-2">
              <span className="w-2 h-2 rounded-full bg-amber-600" />
              <span>Batch Mission Frames ({batchScans.length} images):</span>
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {batchScans.map((bScan, bIdx) => (
                <button
                  key={bScan.id || bIdx}
                  onClick={() => onSelectBatchIndex(bIdx)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                    currentBatchIndex === bIdx
                      ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span className="truncate max-w-[120px]">{bScan.filename}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      bScan.detections.length > 0
                        ? currentBatchIndex === bIdx
                          ? 'bg-amber-800 text-white'
                          : 'bg-stone-200 text-stone-800'
                        : currentBatchIndex === bIdx
                        ? 'bg-amber-800 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {bScan.detections.length}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Detection Results Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <span className="w-1 h-3.5 bg-slate-800 rounded-full" />
            <span>Detection Results {scan && `— ${scan.filename}`}</span>
          </div>

          {detections.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>Sort by</span>
              <div className="relative inline-block">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-2xs focus:outline-none cursor-pointer appearance-none pr-6"
                >
                  <option value="confidence">Confidence</option>
                  <option value="priority">Priority Score</option>
                  <option value="size">Size</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
              </div>
            </div>
          )}
        </div>

        {/* Detection Card(s) */}
        {scan && sortedDetections.length > 0 ? (
          <div className="space-y-4">
            {sortedDetections.map((det, index) => {
              const isBookmarked = !!bookmarkedIds[det.id];
              const detShadow = det.shadowMetrics || (det as any).acoustic_shadow;
              const detEvScore = det.evidenceScore ?? (det as any).evidence_score;
              const detReliability = det.reliability ?? (det as any).reliability;
              const detReviewReq = det.reviewRequired ?? (det as any).review_required;
              const detReasons = det.reviewReasons || (det as any).review_reasons || [];

              return (
                <div
                  key={det.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm transition-all hover:shadow-md animate-in fade-in-50"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="bg-stone-100 text-stone-800 font-bold text-xs px-2 py-0.5 rounded-md">
                        #{index + 1}
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                        {getObjectIcon(det.className)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900 leading-none">
                          {det.className}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {det.category}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {detShadow && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            (detShadow.evidenceStrength || detShadow.evidence_strength) === 'STRONG'
                              ? 'bg-purple-100 text-purple-800'
                              : (detShadow.evidenceStrength || detShadow.evidence_strength) === 'MODERATE'
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Shadow: {detShadow.evidenceStrength || detShadow.evidence_strength}
                        </span>
                      )}

                      {detEvScore !== undefined && (
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            detReliability === 'HIGH'
                              ? 'bg-stone-100 text-stone-800'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          Evidence: {detEvScore}/100
                        </span>
                      )}

                      <div className="flex items-center gap-1 bg-amber-50 text-amber-900 border border-amber-300 text-xs font-bold px-2.5 py-1 rounded-full shadow-2xs">
                        <Check className="w-3 h-3 text-amber-700 stroke-[3]" />
                        <span>{Math.round(det.confidence * 100)}% Confidence</span>
                      </div>
                    </div>
                  </div>

                  {/* Human Verification Warning Alert */}
                  {detReviewReq && (
                    <div className="mb-3 bg-amber-50/90 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-900 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold flex items-center gap-1.5">
                          <span>⚠ HUMAN VERIFICATION RECOMMENDED</span>
                          <span className="text-[10px] font-normal text-amber-700">
                            (Corroborating Evidence Threshold)
                          </span>
                        </div>
                        {detReasons.length > 0 && (
                          <ul className="list-disc list-inside text-[11px] text-amber-800 mt-1 space-y-0.5">
                            {detReasons.map((r: string, rIdx: number) => (
                              <li key={rIdx}>{r}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <SonarCanvas
                        imageUrl={scan.imageUrl}
                        annotatedImageUrl={scan.annotatedImageUrl}
                        detections={[det]}
                      />
                    </div>

                    <div className="flex flex-col justify-between space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <SpeedometerGauge
                          score={det.priorityScore}
                          level={det.priorityLevel}
                        />

                        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-2.5 border border-slate-200/80 shadow-xs flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                            <Box className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                              Dimensions
                            </div>
                            <div className="text-xs font-bold text-slate-800 tracking-tight leading-tight mt-0.5">
                              {det.pixelDimensions.width} × {det.pixelDimensions.height}
                            </div>
                            <div className="text-[10px] text-slate-500">pixels</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 text-xs bg-slate-50/70 p-2 rounded-xl border border-slate-100">
                        <span className="text-stone-600 mt-0.5">🌿</span>
                        <div>
                          <span className="font-semibold text-slate-700">Eco Impact: </span>
                          <span className="text-slate-600">{det.ecoImpact}</span>
                        </div>
                      </div>

                      <div className="flex items-start gap-2 text-xs bg-amber-50/50 p-2 rounded-xl border border-amber-100/70">
                        <FileText className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-amber-900">
                            Recommended Action:{' '}
                          </span>
                          <span className="text-amber-800">{det.actionRecommended}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-mono bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                        <Box className="w-3 h-3 text-amber-700 shrink-0" />
                        <span className="font-semibold text-slate-600">Bounding Box:</span>
                        <span className="truncate">
                          [{det.bbox.map((n) => n.toFixed(2)).join(', ')}]
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                        <button
                          onClick={() => handleVerify(det.id)}
                          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                            det.verificationStatus === 'verified'
                              ? 'bg-stone-800 text-stone-100 shadow-stone-800/30'
                              : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4 text-stone-600" />
                          <span>
                            {det.verificationStatus === 'verified' ? 'Verified ✓' : 'Verify'}
                          </span>
                          <span className="w-2 h-2 rounded-full bg-stone-600 ml-1" />
                        </button>

                        <button
                          onClick={() => onReject(det.id)}
                          className={`flex-1 py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                            det.verificationStatus === 'rejected'
                              ? 'bg-amber-950 text-amber-100 shadow-amber-950/30'
                              : 'bg-white hover:bg-stone-100 text-stone-600 border border-stone-200'
                          }`}
                        >
                          <XCircle className="w-4 h-4 text-stone-500" />
                          <span>
                            {det.verificationStatus === 'rejected' ? 'Rejected ✕' : 'Reject'}
                          </span>
                          <span className="w-2 h-2 rounded-full bg-stone-400 ml-1" />
                        </button>

                        <button
                          onClick={() => toggleBookmark(det.id)}
                          title={isBookmarked ? 'Bookmarked' : 'Bookmark finding'}
                          className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                            isBookmarked
                              ? 'bg-amber-100 text-amber-600 border-amber-300'
                              : 'bg-white text-slate-400 hover:text-slate-600 border-slate-200'
                          }`}
                        >
                          <Bookmark
                            className={`w-4 h-4 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            <div className="flex justify-end pt-1">
              <button
                onClick={() => onDownloadReport(scan)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-sm transition-all active:scale-95 cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-amber-400" />
                <span>Download Executive Survey Report (PDF)</span>
              </button>
            </div>
          </div>
        ) : scan && detections.length === 0 ? (
          /* Scan with 0 Detections (Clean seabed) */
          <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 text-stone-800 bg-stone-100 px-3 py-2 rounded-xl border border-stone-300">
              <CheckCircle className="w-5 h-5 text-stone-700 shrink-0" />
              <div className="text-xs font-semibold">
                Clean Seabed: No debris or hazards detected by YOLO11n (best.pt) in this frame.
              </div>
            </div>

            <div className="max-w-md mx-auto">
              <SonarCanvas
                imageUrl={scan.imageUrl}
                annotatedImageUrl={scan.annotatedImageUrl}
                detections={[]}
              />
            </div>
          </div>
        ) : (
          /* Empty / Awaiting Upload Initial State */
          <div className="h-64 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-6 text-center bg-slate-50/50">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
              <Brain className="w-6 h-6 text-slate-400" />
            </div>
            <div className="text-sm font-bold text-slate-700">Awaiting Sonar Imagery</div>
            <div className="text-xs text-slate-500 max-w-sm mt-1">
              Drag & drop a sonar image or select multiple survey frames on the left and click{' '}
              <span className="font-semibold text-amber-700">"Detect Objects"</span> to run live
              inference with your trained <span className="font-mono text-slate-700">best.pt</span> model.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
