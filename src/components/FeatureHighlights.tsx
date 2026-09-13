import React from 'react';
import { Zap, ShieldCheck, Leaf, BarChart2 } from 'lucide-react';

export const FeatureHighlights: React.FC = () => {
  const features = [
    {
      title: 'Faster Analysis',
      subtitle: 'AI-powered detection',
      icon: Zap,
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      iconColor: 'text-amber-700',
    },
    {
      title: 'More Accurate',
      subtitle: 'Reduce false positives',
      icon: ShieldCheck,
      bg: 'bg-stone-100',
      border: 'border-stone-200',
      iconColor: 'text-stone-700',
    },
    {
      title: 'Cleaner Oceans',
      subtitle: 'Support marine conservation',
      icon: Leaf,
      bg: 'bg-amber-100/60',
      border: 'border-amber-300/60',
      iconColor: 'text-amber-800',
    },
    {
      title: 'Actionable Insights',
      subtitle: 'Turn data into decisions',
      icon: BarChart2,
      bg: 'bg-stone-200/70',
      border: 'border-stone-300/80',
      iconColor: 'text-stone-800',
    },
  ];

  return (
    <div className="w-full mt-6">
      {/* 4 Feature Highlight Cards (Matches Screenshot) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <div
              key={i}
              className="bg-white/90 backdrop-blur-xs rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex items-center gap-3.5 transition-transform hover:-translate-y-0.5"
            >
              <div
                className={`w-11 h-11 rounded-xl ${f.bg} ${f.border} border flex items-center justify-center shrink-0 shadow-2xs`}
              >
                <Icon className={`w-5 h-5 ${f.iconColor}`} />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800 tracking-tight leading-snug">
                  {f.title}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{f.subtitle}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Bar */}
      <footer className="mt-8 pt-4 pb-8 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-2 font-medium">
          <span className="text-amber-700 font-bold">≈</span>
          <span>DeepScan AI</span>
          <span>•</span>
          <span>Underwater Sonar Intelligence</span>
        </div>
      </footer>
    </div>
  );
};
