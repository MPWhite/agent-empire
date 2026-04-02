"use client";

import type { SerializedGameState } from "@/lib/types";

interface PlayerLeaderboardProps {
  gameState: SerializedGameState;
  onPlayerClick: (playerId: string) => void;
  selectedPlayerId: string | null;
}

export default function PlayerLeaderboard({
  gameState,
  onPlayerClick,
  selectedPlayerId,
}: PlayerLeaderboardProps) {
  const players = Object.values(gameState.players);

  // Compute stats per player
  const stats = new Map<string, { territories: number; troops: number }>();
  for (const territory of Object.values(gameState.map.territories)) {
    if (!territory.ownerId) continue;
    const existing = stats.get(territory.ownerId) ?? {
      territories: 0,
      troops: 0,
    };
    existing.territories++;
    existing.troops += territory.troops;
    stats.set(territory.ownerId, existing);
  }

  // Sort: alive first (by territory count desc), then eliminated
  const sorted = [...players].sort((a, b) => {
    if (a.isAlive !== b.isAlive) return a.isAlive ? -1 : 1;
    const sa = stats.get(a.id) ?? { territories: 0, troops: 0 };
    const sb = stats.get(b.id) ?? { territories: 0, troops: 0 };
    return sb.territories - sa.territories || sb.troops - sa.troops;
  });

  return (
    <div className="p-2">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1 md:mb-2 font-mono">
        Leaderboard
      </h3>
      <div className="space-y-0.5">
        {sorted.map((player, i) => {
          const s = stats.get(player.id) ?? { territories: 0, troops: 0 };
          const isSelected = player.id === selectedPlayerId;

          return (
            <button
              key={player.id}
              onClick={() => onPlayerClick(player.id)}
              className={`w-full flex items-center gap-2 text-xs px-2 py-1.5 transition-colors text-left ${
                isSelected
                  ? "bg-zinc-800 border border-zinc-700"
                  : "hover:bg-zinc-900 border border-transparent"
              } ${!player.isAlive ? "opacity-30" : ""}`}
            >
              <span className="text-zinc-600 font-mono text-xs w-5">
                {player.isAlive ? `#${i + 1}` : "—"}
              </span>
              <div
                className="w-2.5 h-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: player.color }}
              />
              <span
                className={`font-mono text-sm flex-1 truncate ${
                  isSelected ? "text-zinc-200" : "text-zinc-400"
                }`}
              >
                {player.name}
              </span>
              <div className="flex items-center gap-2 text-zinc-500 font-mono text-xs shrink-0">
                {player.isAlive && player.tech && (() => {
                  const t = player.tech;
                  const branches: { key: string; label: string; level: number }[] = [
                    { key: 'mil', label: 'Mil', level: t.military },
                    { key: 'eco', label: 'Eco', level: t.economic },
                    { key: 'int', label: 'Int', level: t.intelligence },
                  ];
                  const top = branches.reduce((a, b) => b.level > a.level ? b : a);
                  if (top.level === 0) return null;
                  return (
                    <span className="text-zinc-600 text-[9px]">
                      {top.label}:{top.level}{t.military >= 5 ? ' ☢️' : t.military >= 4 ? ' 🚀' : ''}
                    </span>
                  );
                })()}
                <span>{s.territories}T</span>
                <span>{s.troops}U</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
