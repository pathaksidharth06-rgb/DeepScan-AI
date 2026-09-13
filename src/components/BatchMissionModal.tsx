import React, { useState } from 'react';
import { Layers, X, Play, FileDown, ShieldAlert, Cpu } from 'lucide-react';
import type { SonarScan } from '../types/sonar';
import { generateSurveyPdfReport } from '../services/pdfReportGenerator';

interface BatchMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sampleScans: SonarScan[];
  onCompleteBatch: (scans: SonarScan[]) => void;
}

export const BatchMissionModal: React.FC<BatchMissionModalProps> = ({
  isOpen,
  onClose,
  sampleScans,
  onCompleteBatch,
}) => {
  const [missionName, setMissionName] = useState('Survey-Transect-Echo-7');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  const [results, setResults] = useState<SonarScan[]>([]);

  if (!isOpen) return null;

  const startBatch = async () => {
    setIsProcessing(true);
    setProcessedCount(0);
    const batchResults: SonarScan[] = [];

    for (let i = 0; i < sampleScans.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      batchResults.push(sampleScans[i]);
      setProcessedCount(i + 1);
    }

    setResults(batchResults);
    setIsProcessing(false);
    onCompleteBatch(batchResults);
  };

  const totalDetections = results.reduce((acc, s) => acc + s.detections.length, 0);
  const highPriorityCount = results.reduce(
    (acc, s) => acc + s.detections.filter((d) => d.priorityScore >= 70).length,
    0
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-tight">
                Batch Survey Mission Mode
              </h3>
              <p className="text-xs text-slate-500">
                Process multiple side-scan sonar frames simultaneously & aggregate mission risk
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mission Identifier / Transect Tag
            </label>
            <input
              type="text"
              value={missionName}
              onChange={(e) => setMissionName(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500"
              placeholder="e.g. North-Sea-Grid-B4"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs text-slate-600 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-700" />
              <span>
                Survey Queue: <strong className="text-slate-800">{sampleScans.length} Sonar Frames</strong> queued for batch inference
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">YOLO11n + Intelligence Engine</span>
          </div>

          {isProcessing && (
            <div className="space-y-1.5 animate-in fade-in">
              <div className="flex justify-between text-xs font-semibold text-slate-700">
                <span>Processing frames...</span>
                <span>
                  {processedCount} / {sampleScans.length} completed
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-600 transition-all duration-300 rounded-full"
                  style={{ width: `${(processedCount / sampleScans.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {results.length > 0 && !isProcessing && (
            <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Mission Summary: {missionName}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-2xs">
                  <div className="text-xs text-slate-500 font-medium">Frames Analyzed</div>
                  <div className="text-xl font-bold text-slate-800 mt-0.5">{results.length}</div>
                </div>
                <div className="bg-white p-3 rounded-xl border border-slate-200 text-center shadow-2xs">
                  <div className="text-xs text-slate-500 font-medium">Total Detections</div>
                  <div className="text-xl font-bold text-slate-800 mt-0.5">{totalDetections}</div>
                </div>
                <div className="bg-amber-950 p-3 rounded-xl border border-amber-900 text-center shadow-2xs">
                  <div className="text-xs text-amber-200 font-medium flex items-center justify-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> High Priority
                  </div>
                  <div className="text-xl font-bold text-amber-100 mt-0.5">{highPriorityCount}</div>
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {results.map((s, idx) => (
                  <div
                    key={s.id}
                    className="text-xs bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400">#{idx + 1}</span>
                      <span className="font-semibold text-slate-800">{s.filename}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-600">{s.detections[0]?.className}</span>
                      <span className="bg-stone-100 text-stone-800 font-bold px-1.5 py-0.5 rounded text-[10px] border border-stone-200">
                        {s.detections[0]?.priorityScore}/100
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Close
          </button>
          {results.length > 0 ? (
            <button
              onClick={() => generateSurveyPdfReport(results[0])}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-amber-400" />
              Download Mission Report
            </button>
          ) : (
            <button
              onClick={startBatch}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-amber-900/20 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-white" />
              <span>{isProcessing ? 'Processing Mission...' : 'Execute Batch Inference'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
