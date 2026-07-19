import React, { useState } from 'react';
import { CheckCircle, XCircle, MinusCircle, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import type { AISelfTestReport, AISelfTestResult } from '../types';
import { CATEGORY_LABELS } from '../utils/ai-copilot/TestReportGenerator';
import { Button } from './ui/button';
import { Card } from './ui/card';

interface TestResultsTableProps {
  report: AISelfTestReport | null;
  isRunning?: boolean;
  currentTest?: string;
  progress?: { done: number; total: number };
}

const TestStatusIcon: React.FC<{ status: AISelfTestResult['status'] }> = ({ status }) => {
  if (status === 'pass') return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === 'fail') return <XCircle className="w-3.5 h-3.5 text-red-400" />;
  return <MinusCircle className="w-3.5 h-3.5 text-zinc-500" />;
};

export const TestResultsTable: React.FC<TestResultsTableProps> = ({ report, isRunning, currentTest, progress }) => {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (isRunning && progress) {
    const pct = progress.total > 0 ? (progress.done / progress.total) * 100 : 0;
    return (
      <Card className="mt-2 p-3 bg-indigo-900/20 border-indigo-500/30 text-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
          <span className="font-semibold text-indigo-200">Running Tests</span>
          <span className="ml-auto text-indigo-300">
            {progress.done} / {progress.total}
          </span>
        </div>
        <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        {currentTest && (
          <p className="text-indigo-300/80 truncate flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {currentTest}
          </p>
        )}
      </Card>
    );
  }

  if (!report) return null;

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Card className="mt-2 bg-zinc-900/95 border-white/10 text-xs">
      {/* Header */}
      <div className="p-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-zinc-100">🧪 Test Report</span>
          <span
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              report.failed === 0
                ? 'bg-emerald-500/15 text-emerald-300'
                : report.failed <= report.passed / 4
                ? 'bg-amber-500/15 text-amber-300'
                : 'bg-red-500/15 text-red-300'
            }`}
          >
            {report.passRate.toFixed(0)}% pass
          </span>
        </div>
        <div className="grid grid-cols-4 gap-2 mt-2">
          <Stat label="Total" value={report.totalTests} />
          <Stat label="Pass" value={report.passed} color="text-emerald-400" />
          <Stat label="Fail" value={report.failed} color="text-red-400" />
          <Stat label="Skip" value={report.skipped} color="text-zinc-400" />
        </div>
      </div>

      {/* Categories */}
      <div className="border-b border-white/10">
        {(Object.entries(report.byCategory) as [string, { passed: number; failed: number; total: number }][]).map(([cat, stats]) => {
          const isExpanded = expanded.has(`cat-${cat}`);
          const testResults = report.results.filter((r: AISelfTestResult) => r.category === cat);
          return (
            <div key={cat} className="border-b border-white/5 last:border-b-0">
              <button
                onClick={() => toggle(`cat-${cat}`)}
                className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/[0.02] transition-colors"
              >
                <span className="font-medium text-zinc-200 text-left flex-1 truncate">
                  {(CATEGORY_LABELS as any)[cat] ?? cat}
                </span>
                <span className="text-emerald-400 font-mono">{stats.passed}</span>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-400 font-mono">{stats.total}</span>
                {isExpanded ? (
                  <ChevronUp className="w-3 h-3 text-zinc-500" />
                ) : (
                  <ChevronDown className="w-3 h-3 text-zinc-500" />
                )}
              </button>

              {isExpanded && (
                <div className="px-3 pb-2 space-y-1">
                  {testResults.map((r: AISelfTestResult) => {
                    const testKey = `${r.testId}-${cat}`;
                    return (
                      <div
                        key={testKey}
                        className={`px-2 py-1.5 rounded border ${
                          r.status === 'pass'
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : r.status === 'fail'
                            ? 'bg-red-500/5 border-red-500/20'
                            : 'bg-white/5 border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <TestStatusIcon status={r.status} />
                          <span className="text-zinc-200 flex-1 truncate">{r.testName}</span>
                          <span className="text-zinc-500 font-mono text-[10px]">
                            {r.durationMs}ms
                          </span>
                        </div>
                        {r.error && (
                          <pre className="mt-1 ml-5 text-[10px] text-red-300/80 font-mono whitespace-pre-wrap break-all">
                            {r.error}
                          </pre>
                        )}
                        {r.details && !r.error && (
                          <pre className="mt-1 ml-5 text-[10px] text-zinc-400 font-mono whitespace-pre-wrap break-all">
                            {r.details}
                          </pre>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer summary */}
      <div className="p-3 bg-zinc-950/50">
        {report.workingFeatures.length > 0 && (
          <div className="mb-2">
            <span className="text-emerald-400 font-semibold">
              ✅ {report.workingFeatures.length} Working
            </span>
          </div>
        )}
        {report.notWorkingFeatures.length > 0 && (
          <div>
            <span className="text-red-400 font-semibold">
              ❌ {report.notWorkingFeatures.length} Not Working
            </span>
            <div className="mt-1.5 space-y-0.5">
              {report.notWorkingFeatures.map((f: string, i: number) => (
                <div key={i} className="text-[10px] text-red-300/70 font-mono">
                  • {f}
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-2 flex items-center justify-between text-[10px] text-zinc-500">
          <span>Duration: {(report.durationMs / 1000).toFixed(1)}s</span>
          {report.notWorkingFeatures.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-2 text-[10px] text-zinc-400 hover:text-amber-300"
              onClick={() => {
                navigator.clipboard?.writeText(report.notWorkingFeatures.join('\n'));
              }}
            >
              Copy failures
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

const Stat: React.FC<{
  label: string;
  value: number;
  color?: string;
}> = ({ label, value, color = 'text-zinc-200' }) => (
  <div className="bg-black/30 rounded px-1.5 py-1 text-center">
    <div className={`text-sm font-bold ${color}`}>{value}</div>
    <div className="text-[9px] text-zinc-500 uppercase tracking-wider">{label}</div>
  </div>
);
