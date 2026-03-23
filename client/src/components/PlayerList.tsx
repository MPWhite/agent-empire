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
    <div className="p-3">
      <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2 font-mono">
        Players
      </h3>
      <div className="space-y-1">
        {players.map((player) => {
          const s = stats.get(player.id) ?? { territories: 0, troops: 0 };
          const isMe = player.id === currentPlayerId;

          return (
            <div
              key={player.id}
              className={`flex items-center justify-between text-xs px-2 py-1.5 ${
                isMe ? "bg-zinc-900 border border-zinc-800" : ""
              } ${!player.isAlive ? "opacity-30" : ""}`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2"
                  style={{ backgroundColor: player.color }}
                />
                <span className={`font-mono ${isMe ? "text-zinc-200" : "text-zinc-400"}`}>
                  {player.name}
                  {isMe ? " (YOU)" : ""}
                </span>
                {player.name.startsWith("AI ") && (
                  <span className="text-[9px] text-zinc-600 bg-zinc-900 border border-zinc-800 px-1 font-mono">
                    AI
                  </span>
                )}
              </div>
              <div className="flex gap-3 text-zinc-600 font-mono text-[10px]">
                <span>{s.territories}T</span>
                <span>{s.troops}U</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
