"use client";

import { useEffect, useRef } from "react";
import type { SerializedGameState, AnalystReport } from "@/lib/types";
import PlayerLeaderboard from "./PlayerLeaderboard";
import ReportCard from "./ReportCard";

interface NewsFeedProps {
  reports: AnalystReport[];
  gameState: SerializedGameState;
  onPlayerClick: (playerId: string) => void;
  selectedPlayerId: string | null;
  currentTurn: number;
  pendingTurns: number;
}

export default function NewsFeed({
  reports,
  gameState,
  onPlayerClick,
  selectedPlayerId,
  currentTurn,
  pendingTurns,
}: NewsFeedProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [reports.length, reports[reports.length - 1]?.text]);

  return (
    <div className="grid grid-cols-[1fr_auto] divide-x divide-zinc-800 h-80">
      {/* Reports feed */}
      <div className="overflow-y-auto panel-scroll">
        <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-3 py-1.5 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest font-mono flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              War Desk
            </h3>
            {pendingTurns > 0 && (
              <span className="text-[9px] font-mono text-zinc-700">
                Gathering intel... ({pendingTurns} turns)
              </span>
            )}
          </div>
        </div>

        <div>
          {reports.length === 0 && (
            <div className="px-3 py-8 text-center">
              <div className="text-zinc-700 text-xs font-mono mb-1">
                AWAITING FIRST DISPATCH
              </div>
              <div className="text-zinc-800 text-[10px] font-mono">
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

      {/* Player leaderboard sidebar */}
      <div className="w-56 overflow-y-auto panel-scroll">
        <PlayerLeaderboard
          gameState={gameState}
          onPlayerClick={onPlayerClick}
          selectedPlayerId={selectedPlayerId}
        />
      </div>
    </div>
  );
}
