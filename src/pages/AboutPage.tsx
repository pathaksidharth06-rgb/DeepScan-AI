import React from 'react';
import {
  Info,
  AlertTriangle,
} from 'lucide-react';
import { TAXONOMY_RULES } from '../services/intelligenceEngine';

export const AboutPage: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center">
          <Info className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            DeepScan AI Architecture & Evaluation
          </h2>
          <p className="text-xs text-slate-500">
            Defense & Hackathon (SIH) Technical Documentation & Decision-Support Specifications
          </p>
        </div>
      </div>

      {/* AI Model & Detection Engine */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-amber-950 text-white rounded-3xl p-6 sm:p-8 shadow-md border border-amber-900/40 space-y-3">
        <div className="text-xs font-bold uppercase tracking-widest text-amber-300">
          AI Model & Detection Engine
        </div>

        <p className="text-base sm:text-lg font-medium text-slate-100 leading-relaxed">
          DeepScan AI uses a YOLO11n-based object detection model trained for
          side-scan sonar imagery. The model identifies underwater objects and
          anomalies such as shipwrecks, fishing nets, crab pots, pipes, ropes,
          tires, blocks, boulders and other marine debris. Each detection
          provides a confidence score and bounding box, which is further
          processed by the intelligence layer to determine object category,
          priority level, ecological impact and recommended action.
        </p>
      </div>

      {/* 11-Class Taxonomy Explorer */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            Current 11-Class Sonar Taxonomy
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Rule-based ecological and operational interpretations mapped to each YOLO11n detection
            class.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Class Name</th>
                <th className="px-4 py-3">Category Group</th>
                <th className="px-4 py-3">Ecological / Operational Impact</th>
                <th className="px-4 py-3">Recommended Operator Action</th>
                <th className="px-4 py-3">Base Hazard Weight</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {Object.entries(TAXONOMY_RULES).map(([className, rule]) => (
                <tr
                  key={className}
                  className="hover:bg-slate-50/70"
                >
                  <td className="px-4 py-3 font-bold text-slate-800">
                    {className}
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        rule.category === 'Marine Debris / Anthropogenic'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : rule.category === 'Natural Object'
                          ? 'bg-stone-100 text-stone-800 border border-stone-300'
                          : 'bg-stone-200 text-stone-900 border border-stone-300'
                      }`}
                    >
                      {rule.category}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-slate-700 font-medium">
                    {rule.ecoImpact}
                  </td>

                  <td className="px-4 py-3 text-slate-500">
                    {rule.actionRecommended}
                  </td>

                  <td className="px-4 py-3 font-mono font-bold text-slate-700">
                    {rule.baseEcoWeight} pts
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Technical Honesty Disclosures */}
      <div className="bg-amber-50/70 rounded-3xl p-6 sm:p-8 border border-amber-200/80 shadow-xs space-y-4">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600" />

          <h3 className="text-lg font-bold text-amber-950">
            Important Technical Honesty Points (Scientific Rigor)
          </h3>
        </div>

        <p className="text-xs text-amber-900 leading-relaxed">
          In high-stakes marine robotics and defense evaluations, clear scientific honesty separates
          practical systems from overclaimed demos:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <div className="bg-white/80 p-4 rounded-2xl border border-amber-200/60 text-xs space-y-1.5">
            <span className="font-bold text-slate-800">
              1. mAP50 vs "Accuracy"
            </span>

            <p className="text-slate-600">
              Do not call mAP50 "accuracy". It is an object-detection evaluation metric evaluating
              precision-recall at IoU threshold 0.50 across all 11 classes.
            </p>
          </div>

          <div className="bg-white/80 p-4 rounded-2xl border border-amber-200/60 text-xs space-y-1.5">
            <span className="font-bold text-slate-800">
              2. Pixel Dimensions vs Metric Dimensions
            </span>

            <p className="text-slate-600">
              Without slant-range correction, towfish altitude, and acoustic pulse frequency
              metadata, we accurately report <strong>Pixel Dimensions</strong> rather than claiming
              exact real-world meters.
            </p>
          </div>

          <div className="bg-white/80 p-4 rounded-2xl border border-amber-200/60 text-xs space-y-1.5">
            <span className="font-bold text-slate-800">
              3. Acoustic Scan Animation
            </span>

            <p className="text-slate-600">
              The acoustic sweep animation provides intuitive visual feedback of active beamforming
              to the operator; real beamforming occurs within the sonar transducer array.
            </p>
          </div>

          <div className="bg-white/80 p-4 rounded-2xl border border-amber-200/60 text-xs space-y-1.5">
            <span className="font-bold text-slate-800">
              4. Heuristic Priority Score
            </span>

            <p className="text-slate-600">
              The Priority Score (0-100) is a decision-support heuristic designed to highlight
              ecological and navigation hazards for immediate operator attention, not a certified
              toxicological value.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
