"use client";

import type { SerializedGameState } from "@/lib/types";
import type { Headline } from "@/lib/headlines";

interface PlayerDetailProps {
  playerId: string;
  gameState: SerializedGameState;
  headlines: Headline[];
  onClose: () => void;
}

export default function PlayerDetail({
  playerId,
  gameState,
  headlines,
  onClose,
}: PlayerDetailProps) {
  const player = gameState.players[playerId];
  if (!player) return null;

  // Compute stats
  let territories = 0;
  let troops = 0;
  for (const t of Object.values(gameState.map.territories)) {
    if (t.ownerId === playerId) {
      territories++;
      troops += t.troops;
    }
  }

  // Continents held
  const continentsHeld: string[] = [];
  for (const continent of Object.values(gameState.map.continents)) {
    const ownsAll = continent.territoryIds.every(
      (tid) => gameState.map.territories[tid]?.ownerId === playerId
    );
    if (ownsAll) continentsHeld.push(continent.name);
  }

  // Reinforcement income
  const income = Math.max(3, Math.floor(territories / 3)) +
    Object.values(gameState.map.continents)
      .filter((c) =>
        c.territoryIds.every(
          (tid) => gameState.map.territories[tid]?.ownerId === playerId
        )
      )
      .reduce((sum, c) => sum + c.bonusTroops, 0);

  // Player's recent headlines
  const playerHeadlines = headlines
    .filter((h) => h.playerIds.includes(playerId))
    .slice(-30);

  return (
    <div className="h-80 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3"
            style={{ backgroundColor: player.color }}
          />
          <span className="text-sm font-bold font-mono text-zinc-200 uppercase tracking-wide">
            {player.name}
          </span>
          {player.isAlive ? (
            <span className="text-[9px] font-mono bg-emerald-900 text-emerald-400 px-1.5 py-0.5 uppercase">
              Active
            </span>
          ) : (
            <span className="text-[9px] font-mono bg-red-900 text-red-400 px-1.5 py-0.5 uppercase">
              Eliminated
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-300 text-xs font-mono px-2 py-1 border border-zinc-800 hover:border-zinc-700 transition-colors"
        >
          CLOSE
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 grid grid-cols-[auto_1fr] divide-x divide-zinc-800 overflow-hidden">
        {/* Stats panel */}
        <div className="w-56 p-3 overflow-y-auto panel-scroll">
          <h4 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3 font-mono">
            Intelligence
          </h4>
          <div className="space-y-2">
            <StatRow label="Territories" value={territories.toString()} />
            <StatRow label="Total Troops" value={troops.toString()} />
            <StatRow label="Income/Turn" value={`+${income}`} />
            <StatRow
              label="Continents"
              value={continentsHeld.length > 0 ? continentsHeld.join(", ") : "None"}
            />
          </div>
        </div>

        {/* Activity feed */}
        <div className="overflow-y-auto panel-scroll">
          <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-3 py-1.5 z-10">
            <h4 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest font-mono">
              Recent Activity
            </h4>
          </div>
          <div className="divide-y divide-zinc-900">
            {playerHeadlines.length === 0 && (
              <div className="px-3 py-4 text-zinc-700 text-xs font-mono">
                NO ACTIVITY RECORDED
              </div>
            )}
            {playerHeadlines.map((h) => (
              <div key={h.id} className="px-3 py-1.5 font-mono">
                <div
                  className={`text-[11px] ${
                    h.severity === "breaking"
                      ? "text-red-400 font-bold"
                      : h.severity === "major"
                      ? "text-zinc-300"
                      : "text-zinc-600"
                  }`}
                >
                  {h.headline}
                </div>
                {h.subtext && (
                  <div className="text-[10px] text-zinc-700">{h.subtext}</div>
                )}
                <div className="text-[9px] text-zinc-700">Turn {h.turnNumber}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline">
      <span className="text-[10px] text-zinc-600 font-mono uppercase">
        {label}
      </span>
      <span className="text-xs text-zinc-300 font-mono font-medium">
        {value}
      </span>
    </div>
  );
}
