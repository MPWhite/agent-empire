"use client";

import { useEffect, useState, useRef } from "react";
import type { AnalystReport } from "@/lib/types";

interface BreakingTickerProps {
  reports: AnalystReport[];
  onClickReport?: () => void;
}

export function BreakingTicker({ reports, onClickReport }: BreakingTickerProps) {
  const [visible, setVisible] = useState(false);
  const [currentReport, setCurrentReport] = useState<AnalystReport | null>(null);
  const lastSeenId = useRef<string | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const breaking = reports.filter((r) => r.type === "breaking");
    if (breaking.length === 0) return;

    const latest = breaking[breaking.length - 1];
    if (latest.id === lastSeenId.current) return;

    lastSeenId.current = latest.id;
    setCurrentReport(latest);
    setVisible(true);

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      setVisible(false);
    }, 8000);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [reports]);

  if (!currentReport || !visible) return null;

  return (
    <div
      className="absolute bottom-4 left-4 right-4 z-20 cursor-pointer animate-slide-up"
      onClick={onClickReport}
    >
      <div className="bg-zinc-950/90 backdrop-blur-sm border border-red-900/50 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-mono text-red-400 uppercase font-bold tracking-widest">
            Breaking
          </span>
        </div>
        <p className="text-red-300 text-sm font-medium leading-snug truncate">
          {currentReport.text}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setVisible(false);
          }}
          className="text-zinc-600 hover:text-zinc-400 text-xs font-mono shrink-0"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
