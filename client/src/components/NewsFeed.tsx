"use client";

import { useEffect, useRef } from "react";
import type { SerializedGameState } from "@/lib/types";
import type { Headline } from "@/lib/headlines";
import PlayerLeaderboard from "./PlayerLeaderboard";

interface NewsFeedProps {
  headlines: Headline[];
  gameState: SerializedGameState;
  onPlayerClick: (playerId: string) => void;
  selectedPlayerId: string | null;
}

function severityStyles(severity: Headline["severity"]) {
  switch (severity) {
    case "breaking":
      return {
        row: "bg-red-950/40 border-l-2 border-red-500 px-3 py-2",
        headline: "text-red-400 font-bold text-xs",
        subtext: "text-red-400/60 text-[10px]",
        dot: true,
      };
    case "major":
      return {
        row: "px-3 py-1.5",
        headline: "text-zinc-300 font-medium text-[11px]",
        subtext: "text-zinc-600 text-[10px]",
        dot: false,
      };
    case "minor":
      return {
        row: "px-3 py-1",
        headline: "text-zinc-600 text-[11px]",
        subtext: "text-zinc-700 text-[10px]",
        dot: false,
      };
  }
}

function HeadlineRow({
  headline,
  gameState,
  onPlayerClick,
}: {
  headline: Headline;
  gameState: SerializedGameState;
  onPlayerClick: (playerId: string) => void;
}) {
  const styles = severityStyles(headline.severity);
  const primaryPlayer = headline.playerIds[0];
  const playerColor = primaryPlayer
    ? gameState.players[primaryPlayer]?.color
    : undefined;

  return (
    <button
      onClick={() => primaryPlayer && onPlayerClick(primaryPlayer)}
      className={`w-full text-left flex items-start gap-2 font-mono ${styles.row} hover:bg-zinc-800/50 transition-colors`}
    >
      {/* Player color indicator */}
      <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
        {styles.dot && (
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
        )}
        {playerColor && (
          <div
            className="w-2 h-2 shrink-0"
            style={{ backgroundColor: playerColor }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className={styles.headline}>{headline.headline}</div>
        {headline.subtext && (
          <div className={styles.subtext}>{headline.subtext}</div>
        )}
      </div>

      {/* Turn indicator */}
      <span className="text-zinc-700 text-[9px] font-mono shrink-0 mt-0.5">
        T{headline.turnNumber}
      </span>
    </button>
  );
}

export default function NewsFeed({
  headlines,
  gameState,
  onPlayerClick,
  selectedPlayerId,
}: NewsFeedProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [headlines.length]);

  return (
    <div className="grid grid-cols-[1fr_auto] divide-x divide-zinc-800 h-80">
      {/* Headlines feed */}
      <div className="overflow-y-auto panel-scroll">
        <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-3 py-1.5 z-10">
          <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            Breaking News
          </h3>
        </div>
        <div className="divide-y divide-zinc-900">
          {headlines.length === 0 && (
            <div className="px-3 py-4 text-zinc-700 text-xs font-mono">
              AWAITING FIRST MOVES...
            </div>
          )}
          {headlines.map((headline) => (
            <HeadlineRow
              key={headline.id}
              headline={headline}
              gameState={gameState}
              onPlayerClick={onPlayerClick}
            />
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
