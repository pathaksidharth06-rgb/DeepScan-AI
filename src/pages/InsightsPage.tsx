import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  AlertOctagon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { storageService } from '../services/storageService';
import type { SonarScan } from '../types/sonar';

export const InsightsPage: React.FC = () => {
  const [scans, setScans] = useState<SonarScan[]>([]);

  useEffect(() => {
    const loadData = async () => {
      const backendScans = await storageService.fetchBackendScans();
      const localScans = storageService.getStoredScans();

      const seenIds = new Set<string>();
      const merged: SonarScan[] = [];

      backendScans.forEach((s) => {
        if (!seenIds.has(s.id)) {
          seenIds.add(s.id);
          merged.push(s);
        }
      });

      localScans.forEach((s) => {
        if (!seenIds.has(s.id) && !s.isSample) {
          seenIds.add(s.id);
          merged.push(s);
        }
      });

      setScans(merged);
    };

    loadData();
  }, []);

  const totalScans = scans.length;
  const allDetections = scans.flatMap((s) => s.detections);
  const totalDetections = allDetections.length;
  const highPriority = allDetections.filter((d) => d.priorityScore >= 70).length;
  const verifiedCount = allDetections.filter((d) => d.verificationStatus === 'verified').length;
  const rejectedCount = allDetections.filter((d) => d.verificationStatus === 'rejected').length;
  const unreviewedCount = allDetections.filter((d) => d.verificationStatus === 'unreviewed').length;

  const classCounts: Record<string, number> = {};
  allDetections.forEach((d) => {
    classCounts[d.className] = (classCounts[d.className] || 0) + 1;
  });

  const barChartData = Object.entries(classCounts).map(([className, count]) => ({
    name: className,
    count,
  }));

  const highRiskCount = allDetections.filter((d) => d.priorityLevel === 'HIGH' || d.priorityLevel === 'CRITICAL').length;
  const mediumRiskCount = allDetections.filter((d) => d.priorityLevel === 'MEDIUM').length;
  const lowRiskCount = allDetections.filter((d) => d.priorityLevel === 'LOW').length;

  const priorityData = totalDetections > 0 ? [
    {
      name: 'High Threat (75-100)',
      value: highRiskCount,
      color: '#78350f',
    },
    {
      name: 'Medium Risk (45-74)',
      value: mediumRiskCount,
      color: '#d97706',
    },
    {
      name: 'Low / Benign (0-44)',
      value: lowRiskCount,
      color: '#a8a29e',
    },
  ] : [];

  const hitlData = [
    { name: 'Operator Verified', count: verifiedCount, color: '#78350f' },
    { name: 'Operator Rejected', count: rejectedCount, color: '#44403c' },
    { name: 'Awaiting Review', count: unreviewedCount, color: '#d6d3d1' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-center">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Mission Insights & Analytics
          </h2>
          <p className="text-xs text-slate-500">
            Object distribution, ecological threat levels, and operator review metrics
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-semibold uppercase">Total Scans Audited</div>
          <div className="text-3xl font-black text-slate-800 mt-1">{totalScans}</div>
          <div className="text-[11px] text-slate-400 mt-1">From hydrographic survey missions</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-semibold uppercase">Contacts Classified</div>
          <div className="text-3xl font-black text-amber-700 mt-1">{totalDetections}</div>
          <div className="text-[11px] text-slate-400 mt-1">By YOLO11n + Intelligence Engine</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-semibold uppercase">High Priority Hazards</div>
          <div className="text-3xl font-black text-amber-900 mt-1">{highPriority}</div>
          <div className="text-[11px] text-slate-400 mt-1">Requiring active remediation</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="text-xs text-slate-500 font-semibold uppercase">HITL Review Rate</div>
          <div className="text-3xl font-black text-stone-800 mt-1">
            {totalDetections > 0
              ? `${Math.round(((verifiedCount + rejectedCount) / totalDetections) * 100)}%`
              : '0%'}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Human audit completion</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-700" />
              <span>Contact Frequency by Sonar Class</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">11-Class Taxonomy</span>
          </div>

          <div className="h-64 w-full">
            {barChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" fill="#d97706" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                <span>No sonar contacts classified yet</span>
                <span className="text-[10px] text-slate-400/80 mt-1">Perform a survey scan to view class distribution</span>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-amber-700" />
                <span>Threat Priority Distribution</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">Eco Score</span>
            </div>

            <div className="h-56 w-full">
              {priorityData.filter((d) => d.value > 0).length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={priorityData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                  <span>No threat assessments recorded yet</span>
                  <span className="text-[10px] text-slate-400/80 mt-1">Upload sonar scans to view hazard distribution</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-center mt-2">
            Priority scores are derived from ecological impact weights, detector confidence, and
            sonar pixel footprints.
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-stone-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Human-in-the-Loop (HITL) Quality Assurance Pipeline
            </h3>
          </div>
          <span className="text-xs text-stone-800 bg-stone-100 px-2 py-0.5 rounded-full font-bold border border-stone-300">
            Active Retraining Signal
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hitlData.map((item, i) => (
            <div
              key={i}
              className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between"
            >
              <div>
                <div className="text-xs text-slate-500 font-semibold">{item.name}</div>
                <div className="text-2xl font-bold text-slate-800 mt-1">{item.count}</div>
              </div>
              <div
                className="w-3.5 h-3.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
