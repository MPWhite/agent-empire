"use client";

import type { SerializedGameState } from "@/lib/types";

interface PlayerListProps {
  gameState: SerializedGameState;
  currentPlayerId: string | null;
}

export default function PlayerList({ gameState, currentPlayerId }: PlayerListProps) {
  const players = Object.values(gameState.players);

  // Count territories and troops per player
  const stats = new Map<string, { territories: number; troops: number }>();
  for (const territory of Object.values(gameState.map.territories)) {
    if (!territory.ownerId) continue;
    const existing = stats.get(territory.ownerId) ?? { territories: 0, troops: 0 };
    existing.territories++;
    existing.troops += territory.troops;
    stats.set(territory.ownerId, existing);
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
        Players
      </h3>
      <div className="space-y-1.5">
        {players.map((player) => {
          const s = stats.get(player.id) ?? { territories: 0, troops: 0 };
          const isMe = player.id === currentPlayerId;

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between text-sm px-2 py-1 rounded ${
                isMe ? "bg-zinc-100" : ""
              } ${!player.isAlive ? "opacity-40" : ""}`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: player.color }}
                />
                <span className={isMe ? "font-bold" : ""}>
                  {player.name}
                  {isMe ? " (you)" : ""}
                </span>
              </div>
              <div className="flex gap-3 text-zinc-400 font-mono text-xs">
                <span>{s.territories} terr</span>
                <span>{s.troops} troops</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
