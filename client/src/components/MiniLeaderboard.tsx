"use client";

import type { SerializedGameState } from "@/lib/types";

interface MiniLeaderboardProps {
  gameState: SerializedGameState;
  onPlayerClick: (playerId: string) => void;
}

export function MiniLeaderboard({ gameState, onPlayerClick }: MiniLeaderboardProps) {
  const players = Object.values(gameState.players);

  const stats = new Map<string, { territories: number; troops: number }>();
  for (const territory of Object.values(gameState.map.territories)) {
    if (!territory.ownerId) continue;
    const existing = stats.get(territory.ownerId) ?? { territories: 0, troops: 0 };
    existing.territories++;
    existing.troops += territory.troops;
    stats.set(territory.ownerId, existing);
  }

  const sorted = players
    .filter((p) => p.isAlive)
    .sort((a, b) => {
      const sa = stats.get(a.id) ?? { territories: 0, troops: 0 };
      const sb = stats.get(b.id) ?? { territories: 0, troops: 0 };
      return sb.territories - sa.territories || sb.troops - sa.troops;
    })
    .slice(0, 5);

  if (sorted.length === 0) return null;

  return (
    <div className="absolute top-2 right-2 bg-zinc-950/85 backdrop-blur-sm border border-zinc-800 pointer-events-auto w-44">
      {sorted.map((player, i) => {
        const s = stats.get(player.id) ?? { territories: 0, troops: 0 };
        return (
          <button
            key={player.id}
            onClick={() => onPlayerClick(player.id)}
            className="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] font-mono hover:bg-zinc-800/60 transition-colors text-left"
          >
            <span className="text-zinc-600 w-4 text-right shrink-0">
              {i + 1}
            </span>
            <div
              className="w-2 h-2 shrink-0 rounded-sm"
              style={{ backgroundColor: player.color }}
            />
            <span className="text-zinc-400 truncate flex-1">
              {player.name}
            </span>
            <span className="text-zinc-600 shrink-0">
              {s.territories}
            </span>
          </button>
        );
      })}
    </div>
  );
}
