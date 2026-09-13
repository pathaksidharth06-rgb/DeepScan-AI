import React from 'react';
import type { PriorityLevel } from '../types/sonar';

interface SpeedometerGaugeProps {
  score: number; // 0 to 100
  level: PriorityLevel;
}

export const SpeedometerGauge: React.FC<SpeedometerGaugeProps> = ({ score, level }) => {
  // SVG semi-circle gauge calculations
  const angleDeg = 180 - (score / 100) * 180;
  const angleRad = (angleDeg * Math.PI) / 180;

  const cx = 65;
  const cy = 60;
  const needleLength = 36;

  // Needle tip position
  const nx = cx + needleLength * Math.cos(angleRad);
  const ny = cy - needleLength * Math.sin(angleRad);

  const getBadgeStyle = () => {
    switch (level) {
      case 'CRITICAL':
      case 'HIGH':
        return 'bg-amber-950 text-amber-100 border-amber-900';
      case 'MEDIUM':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'LOW':
      default:
        return 'bg-stone-100 text-stone-800 border-stone-300';
    }
  };

  return (
    <div className="flex items-center gap-3 bg-white/70 backdrop-blur-sm rounded-xl p-2.5 border border-slate-200/80 shadow-xs">
      {/* Semi-circular Speedometer SVG */}
      <div className="relative w-28 h-16 flex items-center justify-center overflow-hidden">
        <svg viewBox="0 0 130 75" className="w-full h-full">
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#d6d3d1" />    {/* Light stone */}
              <stop offset="40%" stopColor="#f59e0b" />   {/* Warm Gold */}
              <stop offset="70%" stopColor="#b45309" />   {/* Deep Amber */}
              <stop offset="100%" stopColor="#78350f" />  {/* Burnt Bronze */}
            </linearGradient>
            <filter id="gaugeShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.15" />
            </filter>
          </defs>

          {/* Background arc track */}
          <path
            d="M 15 62 A 50 50 0 0 1 115 62"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* Colored gradient arc */}
          <path
            d="M 15 62 A 50 50 0 0 1 115 62"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth="7"
            strokeLinecap="round"
            filter="url(#gaugeShadow)"
          />

          {/* Scale tick marks */}
          <circle cx="15" cy="62" r="2" fill="#a8a29e" />
          <circle cx="65" cy="12" r="2" fill="#f59e0b" />
          <circle cx="115" cy="62" r="2" fill="#78350f" />

          {/* Needle / Indicator line */}
          <line
            x1={cx}
            y1={cy}
            x2={nx}
            y2={ny}
            stroke="#334155"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          {/* Needle center hub */}
          <circle cx={cx} cy={cy} r="4.5" fill="#1e293b" />
          <circle cx={cx} cy={cy} r="2" fill="#f8fafc" />
        </svg>
      </div>

      {/* Numerical score & Level badge */}
      <div className="flex flex-col">
        <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
          Priority Score
        </span>
        <div className="flex items-baseline gap-1.5 mt-0.5">
          <span className="text-2xl font-bold text-slate-800 tracking-tight leading-none">
            {score}
          </span>
        </div>
        <div className="mt-1">
          <span
            className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${getBadgeStyle()}`}
          >
            {level}
          </span>
        </div>
      </div>
    </div>
  );
};
