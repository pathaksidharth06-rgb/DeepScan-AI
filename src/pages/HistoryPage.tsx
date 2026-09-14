import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  FileDown,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Trash2,
} from 'lucide-react';

import type { SonarScan } from '../types/sonar';
import { storageService } from '../services/storageService';
import { generateSurveyPdfReport } from '../services/pdfReportGenerator';

const resolveSonarImageUrl = (url?: string) => {
  if (!url) return '';

  if (url.startsWith('/outputs')) {
    return `https://deepscan-ai-tyvx.onrender.com${url}`;
  }

  return url;
};

export const HistoryPage: React.FC = () => {
  const [scans, setScans] = useState<SonarScan[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'verified' | 'rejected' | 'unreviewed'
  >('all');
  const [priorityFilter, setPriorityFilter] = useState<
    'all' | 'HIGH' | 'MEDIUM' | 'LOW'
  >('all');
  const [inspectScan, setInspectScan] = useState<SonarScan | null>(null);

  useEffect(() => {
    const loadScans = async () => {
      try {
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
      } catch (error) {
        console.error('Failed to load scan history:', error);
      }
    };

    loadScans();
  }, []);

  const handleVerify = (scanId: string, detId: string) => {
    storageService.updateDetectionReview(scanId, detId, 'verified');

    setScans((prev) =>
      prev.map((s) => {
        if (s.id === scanId) {
          return {
            ...s,
            detections: s.detections.map((d) =>
              d.id === detId
                ? { ...d, verificationStatus: 'verified' as const }
                : d
            ),
          };
        }

        return s;
      })
    );
  };

  const handleReject = (scanId: string, detId: string) => {
    storageService.updateDetectionReview(scanId, detId, 'rejected');

    setScans((prev) =>
      prev.map((s) => {
        if (s.id === scanId) {
          return {
            ...s,
            detections: s.detections.map((d) =>
              d.id === detId
                ? { ...d, verificationStatus: 'rejected' as const }
                : d
            ),
          };
        }

        return s;
      })
    );
  };

  const handleDeleteScan = async (scanId: string) => {
    if (window.confirm('Delete this scan record from history?')) {
      await storageService.deleteScan(scanId);
      setScans((prev) => prev.filter((s) => s.id !== scanId));
    }
  };

  const handleClearAll = async () => {
    if (
      window.confirm(
        'Are you sure you want to delete ALL scan history and audit trail records? This cannot be undone.'
      )
    ) {
      await storageService.clearAllScans();
      setScans([]);
    }
  };

  const filteredScans = scans.filter((scan) => {
    const primary = scan.detections[0];

    const search = searchTerm.toLowerCase();

    const matchesSearch =
      scan.filename.toLowerCase().includes(search) ||
      primary?.className.toLowerCase().includes(search) ||
      primary?.ecoImpact.toLowerCase().includes(search);

    const matchesStatus =
      statusFilter === 'all' ||
      primary?.verificationStatus === statusFilter;

    const matchesPriority =
      priorityFilter === 'all' ||
      primary?.priorityLevel === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6 overflow-hidden">

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">

        <div className="flex items-start sm:items-center gap-3 min-w-0 w-full lg:w-auto">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
            <History className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-tight break-words">
              Scan History & Audit Trail
            </h2>

            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed break-words">
              Persistent SQLite & local survey ledger with Human-in-the-Loop review tracking
            </p>
          </div>
        </div>

        {/* ACTION BUTTONS */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">

          {scans.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-300 text-xs sm:text-sm font-semibold shadow-xs cursor-pointer transition-all w-full sm:w-auto"
              title="Clear all scan history from SQLite database and local storage"
            >
              <Trash2 className="w-4 h-4 text-stone-600 shrink-0" />
              <span>Clear History</span>
            </button>
          )}

          <button
            onClick={() => storageService.exportRetrainingData()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-semibold shadow-xs cursor-pointer transition-all w-full sm:w-auto"
          >
            <Download className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-center">
              Export Curated Retraining Dataset (JSON)
            </span>
          </button>
        </div>
      </div>

      {/* SEARCH + FILTERS */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs">

        {/* SEARCH */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />

          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by filename or class..."
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        {/* FILTERS */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-4 w-full">

          {/* STATUS */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-sm text-slate-600 w-full min-w-0">
            <div className="flex items-center gap-1.5 shrink-0">
              <Filter className="w-4 h-4 text-slate-400" />
              <span>Status:</span>
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as
                    | 'all'
                    | 'verified'
                    | 'rejected'
                    | 'unreviewed'
                )
              }
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 cursor-pointer w-full min-w-0"
            >
              <option value="all">All Status</option>
              <option value="verified">Verified Only</option>
              <option value="rejected">Rejected Only</option>
              <option value="unreviewed">Unreviewed Only</option>
            </select>
          </div>

          {/* PRIORITY */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 text-sm text-slate-600 w-full min-w-0">
            <span className="shrink-0">Priority:</span>

            <select
              value={priorityFilter}
              onChange={(e) =>
                setPriorityFilter(
                  e.target.value as 'all' | 'HIGH' | 'MEDIUM' | 'LOW'
                )
              }
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 cursor-pointer w-full min-w-0"
            >
              <option value="all">All Priorities</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* HISTORY TABLE */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">

        <div className="overflow-x-auto w-full">

          <table className="w-full min-w-[850px] text-left text-xs">

            <thead className="bg-slate-50 border-b border-slate-200/80 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-6 py-3.5">Sonar Scan</th>
                <th className="px-6 py-3.5">Primary Target</th>
                <th className="px-6 py-3.5">Confidence</th>
                <th className="px-6 py-3.5">Priority Score</th>
                <th className="px-6 py-3.5">HITL Status</th>
                <th className="px-6 py-3.5">Processed Time</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">

              {filteredScans.length > 0 ? (
                filteredScans.map((scan) => {
                  const det = scan.detections[0];

                  return (
                    <tr
                      key={scan.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >

                      {/* SONAR SCAN */}
                      <td className="px-4 sm:px-6 py-3.5">
                        <div className="flex items-center gap-3 min-w-0">

                          <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-slate-200 flex items-center justify-center">

                            {scan.imageUrl ? (
                              <img
                                src={resolveSonarImageUrl(scan.imageUrl)}
                                alt={scan.filename}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display =
                                    'none';
                                }}
                              />
                            ) : (
                              <div className="text-[10px] text-slate-500 font-mono">
                                N/A
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 max-w-[420px]">
                            <div className="font-bold text-slate-900 break-words">
                              {scan.filename}
                            </div>

                            <div className="text-[11px] text-slate-400 whitespace-nowrap">
                              {scan.resolution.width} × {scan.resolution.height} •{' '}
                              {scan.fileSizeMB} MB
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* PRIMARY TARGET */}
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-slate-800">
                          {det?.className || 'None'}
                        </div>

                        <div className="text-[10px] text-slate-500">
                          {det?.category}
                        </div>
                      </td>

                      {/* CONFIDENCE */}
                      <td className="px-6 py-3.5 font-mono font-medium text-slate-700">
                        {det
                          ? `${Math.round(det.confidence * 100)}%`
                          : 'N/A'}
                      </td>

                      {/* PRIORITY */}
                      <td className="px-6 py-3.5">
                        {det ? (
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-800">
                              {det.priorityScore}
                            </span>

                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                det.priorityLevel === 'HIGH'
                                  ? 'bg-amber-950 text-amber-100 border-amber-900'
                                  : det.priorityLevel === 'MEDIUM'
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-stone-100 text-stone-800 border-stone-300'
                              }`}
                            >
                              {det.priorityLevel}
                            </span>
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>

                      {/* HITL STATUS */}
                      <td className="px-6 py-3.5">
                        {det?.verificationStatus === 'verified' ? (
                          <span className="inline-flex items-center gap-1 bg-stone-100 text-stone-800 border border-stone-300 font-bold px-2 py-0.5 rounded-full text-[10px]">
                            <CheckCircle2 className="w-3 h-3 text-stone-700" />
                            Verified
                          </span>
                        ) : det?.verificationStatus === 'rejected' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-950 text-amber-100 border border-amber-900 font-bold px-2 py-0.5 rounded-full text-[10px]">
                            <XCircle className="w-3 h-3 text-amber-200" />
                            Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 font-medium px-2 py-0.5 rounded-full text-[10px]">
                            <Clock className="w-3 h-3 text-slate-400" />
                            Pending Review
                          </span>
                        )}
                      </td>

                      {/* PROCESSED TIME */}
                      <td className="px-6 py-3.5 text-slate-500 font-mono text-[11px]">
                        {scan.processedAt}
                      </td>

                      {/* ACTIONS */}
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">

                          {det && (
                            <>
                              <button
                                onClick={() =>
                                  handleVerify(scan.id, det.id)
                                }
                                title="Mark Verified"
                                className="p-1 rounded-md text-stone-700 hover:bg-stone-100 cursor-pointer"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </button>

                              <button
                                onClick={() =>
                                  handleReject(scan.id, det.id)
                                }
                                title="Mark Rejected"
                                className="p-1 rounded-md text-amber-900 hover:bg-amber-100 cursor-pointer"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          <button
                            onClick={() =>
                              generateSurveyPdfReport(scan)
                            }
                            title="Download PDF Report"
                            className="p-1 rounded-md text-slate-600 hover:bg-slate-100 cursor-pointer"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => setInspectScan(scan)}
                            title="Inspect Image"
                            className="p-1 rounded-md text-amber-700 hover:bg-amber-50 cursor-pointer"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() =>
                              handleDeleteScan(scan.id)
                            }
                            title="Delete Scan Record"
                            className="p-1 rounded-md text-slate-400 hover:text-stone-700 hover:bg-stone-100 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-slate-400"
                  >
                    No scans found matching your filter criteria.
                  </td>
                </tr>
              )}

            </tbody>
          </table>

        </div>
      </div>

      {/* IMAGE INSPECT MODAL */}
      {inspectScan && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">

          <div className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in my-auto">

            {/* MODAL HEADER */}
            <div className="flex justify-between items-start gap-3 mb-4">

              <h3 className="font-bold text-slate-900 text-sm sm:text-base break-all min-w-0">
                {inspectScan.filename}
              </h3>

              <button
                onClick={() => setInspectScan(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer shrink-0"
              >
                ✕
              </button>

            </div>

            {/* IMAGE */}
            <div className="w-full h-56 sm:h-64 bg-slate-950 rounded-xl overflow-hidden mb-4 border border-slate-200 flex items-center justify-center">

              {inspectScan.annotatedImageUrl ||
              inspectScan.imageUrl ? (
                <img
                  src={resolveSonarImageUrl(
                    inspectScan.annotatedImageUrl ||
                      inspectScan.imageUrl
                  )}
                  alt={inspectScan.filename}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-slate-400 text-xs">
                  No image preview available
                </div>
              )}

            </div>

            {/* DETAILS */}
            <div className="space-y-2 text-xs">

              <div className="flex justify-between gap-4 py-2 border-b border-slate-100">
                <span className="text-slate-500">
                  Detected Object:
                </span>

                <span className="font-bold text-slate-800 text-right">
                  {inspectScan.detections[0]?.className || 'None'}
                </span>
              </div>

              <div className="flex justify-between gap-4 py-2 border-b border-slate-100">
                <span className="text-slate-500">
                  Priority Score:
                </span>

                <span className="font-bold text-slate-800 text-right">
                  {inspectScan.detections[0]?.priorityScore} / 100
                </span>
              </div>

              <div className="flex justify-between gap-4 py-2 border-b border-slate-100">
                <span className="text-slate-500">
                  Eco Impact:
                </span>

                <span className="text-slate-700 text-right break-words">
                  {inspectScan.detections[0]?.ecoImpact}
                </span>
              </div>

            </div>

            {/* PDF BUTTON */}
            <div className="mt-5 flex justify-end">

              <button
                onClick={() =>
                  generateSurveyPdfReport(inspectScan)
                }
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer w-full sm:w-auto"
              >
                <FileDown className="w-3.5 h-3.5 text-amber-400" />
                Download PDF
              </button>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
