import React from 'react';
import { Waves, Scan, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { NavTab } from '../components/Header';

interface HomePageProps {
  onNavigate: (tab: NavTab) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-12">
      {/* Hero Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-900 via-stone-900 to-amber-950 p-8 sm:p-12 text-white shadow-xl border border-slate-800">
        <div className="absolute inset-0 opacity-15 pointer-events-none">
          <svg viewBox="0 0 800 400" className="w-full h-full object-cover">
            <path
              d="M 0 100 Q 200 40, 400 120 T 800 90"
              fill="none"
              stroke="#d97706"
              strokeWidth="2"
            />
            <path
              d="M 0 180 Q 250 240, 500 160 T 800 220"
              fill="none"
              stroke="#b45309"
              strokeWidth="1.5"
            />
            <path
              d="M 0 260 Q 300 200, 600 300 T 800 280"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2"
            />
          </svg>
        </div>

        <div className="relative z-10 max-w-3xl space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-950/70 border border-amber-500/40 text-amber-200 text-xs font-semibold tracking-wider uppercase">
            <Waves className="w-3.5 h-3.5 animate-pulse" />
            <span>Autonomous Side-Scan Sonar Decision Support</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            Transforming Raw Sonar into{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-stone-200">
              Actionable Marine Intelligence
            </span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
            DeepScan AI bridges the gap between deep-learning object detection (YOLO11n) and
            operational marine decision-making. Detect ghost fishing nets, shipwrecks, and subsea
            infrastructure with automated ecological hazard scoring and human-in-the-loop review.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => onNavigate('analyze')}
              className="px-6 py-3 rounded-2xl font-bold text-white bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-lg shadow-amber-900/20 flex items-center gap-2 text-sm transition-all duration-150 cursor-pointer active:scale-95"
            >
              <Scan className="w-4 h-4" />
              <span>Launch Command Center</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onNavigate('about')}
              className="px-5 py-3 rounded-2xl font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-sm transition-colors cursor-pointer"
            >
              Architecture & SIH Presentation
            </button>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-slate-800/80 text-left">
          <div>
            <div className="text-xs text-slate-400 font-medium">Model Core</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5">YOLO11n</div>
            <div className="text-[11px] text-slate-500">11 Classified Categories</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Inference Latency</div>
            <div className="text-xl font-bold text-amber-300 mt-0.5">38 - 45 ms</div>
            <div className="text-[11px] text-slate-500">Near real-time sonar sweep</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Ecological Engine</div>
            <div className="text-xl font-bold text-amber-500 mt-0.5">Heuristic 0-100</div>
            <div className="text-[11px] text-slate-500">Dynamic threat prioritization</div>
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Audit Trail</div>
            <div className="text-xl font-bold text-stone-300 mt-0.5">HITL Verified</div>
            <div className="text-[11px] text-slate-500">Curated retraining loop</div>
          </div>
        </div>
      </div>

      {/* Baseline vs Upgraded Platform */}
      <div className="bg-white rounded-3xl p-8 border border-slate-200/90 shadow-sm">
        <div className="max-w-3xl mb-6">
          <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
            From Demo Page to Operational Command Center
          </span>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight mt-1">
            Why DeepScan AI is More than Just a Model
          </h2>
          <p className="text-xs text-slate-500 mt-1.5">
            A standard detector answers "What object is here?". Real hydrographic operators need to
            know: "How critical is it?", "Should I review it?", and "Can I download an auditable
            mission package?".
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase">Standard Prototype</span>
              <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-semibold">
                Baseline
              </span>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-600">
              <li className="flex items-start gap-2">
                <span className="text-slate-400">•</span>
                <span>Raw class name & confidence float only</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400">•</span>
                <span>Single-image isolated inference</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400">•</span>
                <span>Transient memory: results disappear on refresh</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400">•</span>
                <span>No structured feedback mechanism for hydrographers</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-slate-400">•</span>
                <span>Basic image preview with bounding box</span>
              </li>
            </ul>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-b from-amber-50/60 to-stone-50/50 border border-amber-200 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 uppercase">
                Upgraded Sonar Intelligence Platform
              </span>
              <span className="text-xs bg-amber-700 text-white px-2 py-0.5 rounded-full font-bold">
                DeepScan AI Target
              </span>
            </div>
            <ul className="space-y-2.5 text-xs text-slate-800">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Intelligence Engine:</strong> Object + confidence + eco-impact + priority
                  speedometer + action
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Batch Survey Mission Mode:</strong> Run 10-20 sonar frames simultaneously
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Persistent History:</strong> SQLite & Local storage audit trail with
                  telemetry
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Human-in-the-Loop (HITL):</strong> Verify/Reject workflow curate future
                  retraining datasets
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-stone-700 shrink-0 mt-0.5" />
                <span>
                  <strong>Automated Survey PDF:</strong> Shareable, certified maritime survey reports
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md">
        <div className="space-y-1 text-center sm:text-left">
          <h3 className="text-xl font-bold">Ready to analyze side-scan sonar files?</h3>
          <p className="text-xs text-slate-400">
            Select from shipwreck, ghost fishing net, pipeline, tire, and boulder presets or upload
            custom sonar data.
          </p>
        </div>
        <button
          onClick={() => onNavigate('analyze')}
          className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-bold text-xs shrink-0 shadow-sm cursor-pointer transition-all active:scale-95"
        >
          Open Analyze Command Center
        </button>
      </div>
    </div>
  );
};
