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
    <div className="flex flex-col md:grid md:grid-cols-[1fr_auto] 2xl:flex 2xl:flex-col divide-y md:divide-y-0 md:divide-x 2xl:divide-x-0 2xl:divide-y divide-zinc-800 h-full">
      {/* Reports feed */}
      <div className="overflow-y-auto panel-scroll flex-1 min-h-0 order-2 md:order-1 2xl:order-2">
        <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-3 py-1.5 z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest font-mono flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
              War Desk
            </h3>
            {pendingTurns > 0 && (
              <span className="text-xs font-mono text-zinc-600">
                Gathering intel... ({pendingTurns} turns)
              </span>
            )}
          </div>
        </div>

        <div>
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

      {/* Player leaderboard */}
      <div className="w-full md:w-64 2xl:w-full overflow-y-auto panel-scroll order-1 md:order-2 2xl:order-1 max-h-24 md:max-h-none 2xl:max-h-none shrink-0">
        <PlayerLeaderboard
          gameState={gameState}
          onPlayerClick={onPlayerClick}
          selectedPlayerId={selectedPlayerId}
        />
      </div>
    </div>
  );
}
