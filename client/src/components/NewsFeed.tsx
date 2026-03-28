"use client";

import { useEffect, useRef } from "react";
import type { AnalystReport } from "@/lib/types";
import ReportCard from "./ReportCard";

interface NewsFeedProps {
  reports: AnalystReport[];
  currentTurn: number;
  pendingTurns: number;
}

export default function NewsFeed({
  reports,
  currentTurn,
  pendingTurns,
}: NewsFeedProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [reports.length, reports[reports.length - 1]?.text]);

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-3 py-1.5 z-10">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            War Desk
          </h3>
          {pendingTurns > 0 && (
            <span className="text-xs font-mono text-zinc-600">
              Gathering intel...
            </span>
          )}
        </div>
      </div>

      <div className="overflow-y-auto panel-scroll flex-1 min-h-0">
        {reports.length === 0 && (
          <div className="px-3 py-8 text-center">
            <div className="text-zinc-600 text-sm font-mono mb-1">
              AWAITING FIRST DISPATCH
            </div>
            <div className="text-zinc-700 text-xs font-mono">
              First report in ~{Math.max(1, 10 - currentTurn)} turns
            </div>
          </div>
        )}
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
