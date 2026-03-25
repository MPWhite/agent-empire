"use client";

import type { AnalystReport } from "@/lib/types";

interface ReportCardProps {
  report: AnalystReport;
}

export default function ReportCard({ report }: ReportCardProps) {
  if (report.type === "breaking") {
    return (
      <div className="bg-red-950/30 border-l-2 border-red-500 px-4 py-3">
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs font-mono text-red-400 uppercase font-bold tracking-widest">
            Breaking
          </span>
          <span className="text-xs font-mono text-zinc-600 ml-auto">
            Turn {report.turnRange[0]}
          </span>
        </div>
        <p className="text-red-300 text-sm font-medium leading-relaxed">
          {report.text}
          {report.isStreaming && (
            <span className="inline-block w-1.5 h-3.5 bg-red-400 ml-0.5 animate-pulse" />
          )}
        </p>
      </div>
    );
  }

  // Dispatch report
  return (
    <div className="border border-zinc-800 mx-2 my-2">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-zinc-900/50">
        <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest font-semibold">
          Field Dispatch
        </span>
        <span className="text-xs font-mono text-zinc-600">
          Turns {report.turnRange[0]}&ndash;{report.turnRange[1]}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-3">
        <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">
          {report.text}
          {report.isStreaming && (
            <span className="inline-block w-1.5 h-3.5 bg-zinc-500 ml-0.5 animate-pulse" />
          )}
        </div>
        {!report.text && report.isStreaming && (
          <div className="flex items-center gap-2 text-zinc-600 text-xs font-mono">
            <div className="w-1 h-1 bg-zinc-600 rounded-full animate-pulse" />
            Composing dispatch...
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-zinc-800/50">
        <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-wider">
          Agent Empires War Desk &bull;{" "}
          {new Date(report.timestamp).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
