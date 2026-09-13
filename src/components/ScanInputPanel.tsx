import React, { useRef } from 'react';
import {
  Image as ImageIcon,
  UploadCloud,
  Trash2,
  Sparkles,
  RotateCcw,
  Lightbulb,
  Layers,
} from 'lucide-react';
import type { SonarScan } from '../types/sonar';

interface ScanInputPanelProps {
  uploadedFiles: File[];
  selectedScan: SonarScan | null;
  onFilesSelected: (files: File[]) => void;
  onRemoveFile: (index: number) => void;
  onClear: () => void;
  onDetect: () => void;
  isScanning: boolean;
  onSelectSamplePreset?: (sampleName: string) => void;
}

export const ScanInputPanel: React.FC<ScanInputPanelProps> = ({
  uploadedFiles,
  selectedScan,
  onFilesSelected,
  onRemoveFile,
  onClear,
  onDetect,
  isScanning,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelected(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelected(Array.from(e.target.files));
    }
  };

  const hasFiles = uploadedFiles.length > 0 || selectedScan !== null;

  return (
    <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 border border-slate-200/80 shadow-md flex flex-col justify-between h-full">
      <div>
        {/* Card Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shadow-2xs border border-slate-200/60">
              <ImageIcon className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                SCAN INPUT
              </div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Upload Sonar Image(s)
              </h2>
            </div>
          </div>

          {uploadedFiles.length > 1 && (
            <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-300 rounded-full text-xs font-bold shadow-2xs">
              <Layers className="w-3.5 h-3.5" />
              <span>Batch Mode ({uploadedFiles.length} Images)</span>
            </span>
          )}
        </div>

        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          Upload a single Side-Scan Sonar frame or multiple survey images simultaneously for batch detection.
        </p>

        {/* Drag & Drop Zone with Multi-file support */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className="relative group cursor-pointer border-2 border-dashed border-slate-300 hover:border-slate-400 bg-gradient-to-b from-slate-50/50 to-slate-100/60 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all duration-200 overflow-hidden min-h-[170px]"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".png,.jpg,.jpeg,.webp,.tif"
            multiple
            className="hidden"
          />

          {/* Circular Upload Icon Button */}
          <div className="relative z-10 w-12 h-12 rounded-full bg-slate-800 text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform duration-150 mb-3">
            <UploadCloud className="w-6 h-6 text-slate-100" />
          </div>

          <div className="relative z-10 font-bold text-slate-800 text-sm tracking-tight">
            Drag & Drop Sonar Image(s) Here
          </div>
          <div className="relative z-10 text-xs text-slate-500 mt-0.5">
            or click to browse from computer (Select 1 or multiple files)
          </div>
          <div className="relative z-10 text-[11px] text-slate-400 mt-2 font-medium">
            Supports: png, .jpg, .jpeg, .webp, .tif (Batch upload supported)
          </div>
        </div>

        {/* Selected Images List (Batch or Single) */}
        {uploadedFiles.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold uppercase tracking-wide">
              <span>Selected Files ({uploadedFiles.length})</span>
              <button
                onClick={onClear}
                className="text-stone-500 hover:text-stone-800 text-[11px] font-bold cursor-pointer"
              >
                Clear All
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {uploadedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-xl p-2.5 border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3 animate-in fade-in"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-mono text-xs shrink-0 font-bold">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">
                        {file.name}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {(file.size / (1024 * 1024)).toFixed(2)} MB
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFile(idx);
                    }}
                    title="Remove file"
                    className="p-1 text-slate-400 hover:text-stone-800 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <button
            onClick={onDetect}
            disabled={!hasFiles || isScanning}
            className={`col-span-2 py-3 px-5 rounded-2xl font-bold text-white text-sm shadow-md flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer ${
              !hasFiles || isScanning
                ? 'opacity-60 cursor-not-allowed bg-slate-400'
                : 'hover:brightness-110 active:scale-[0.98] shadow-amber-900/20'
            }`}
            style={{
              background:
                !hasFiles || isScanning
                  ? undefined
                  : 'linear-gradient(135deg, #a76d4e 0%, #824f33 45%, #5a341f 100%)',
            }}
          >
            {isScanning ? (
              <>
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                <span>
                  {uploadedFiles.length > 1
                    ? `Processing Batch (${uploadedFiles.length} Images)...`
                    : 'Running YOLO11n (best.pt)...'}
                </span>
              </>
            ) : (
              <>
                <span>
                  {uploadedFiles.length > 1
                    ? `▶ Detect Objects in Batch (${uploadedFiles.length})`
                    : '▶ Detect Objects'}
                </span>
                <Sparkles className="w-4 h-4 text-amber-200 fill-amber-200" />
              </>
            )}
          </button>

          <button
            onClick={onClear}
            disabled={!hasFiles && !selectedScan}
            className="py-3 px-4 rounded-2xl font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs flex items-center justify-center gap-1.5 text-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-40"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      <div className="mt-5 bg-slate-100/80 rounded-xl px-3.5 py-2.5 border border-slate-200/70 flex items-center gap-2 text-xs text-slate-600">
        <Lightbulb className="w-4 h-4 text-amber-500 shrink-0" />
        <span>Tip: Select multiple sonar images to process an entire survey mission at once.</span>
      </div>
    </div>
  );
};
