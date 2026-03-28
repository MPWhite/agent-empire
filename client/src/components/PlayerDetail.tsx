"use client";

import type { SerializedGameState } from "@/lib/types";
import type { TurnHistoryEntry, PlayerDeltas } from "@/lib/useTurnHistory";
import TerritoryChart from "./TerritoryChart";

interface PlayerDetailProps {
  playerId: string;
  gameState: SerializedGameState;
  turnHistory: TurnHistoryEntry[];
  deltas: PlayerDeltas;
  onClose: () => void;
}

export default function PlayerDetail({
  playerId,
  gameState,
  turnHistory,
  deltas,
  onClose,
}: PlayerDetailProps) {
  const player = gameState.players[playerId];
  if (!player) return null;

  // Compute stats
  let territories = 0;
  let troops = 0;
  let totalTerritories = 0;
  for (const t of Object.values(gameState.map.territories)) {
    totalTerritories++;
    if (t.ownerId === playerId) {
      territories++;
      troops += t.troops;
    }
  }

  // Continents — all of them, marking which are held
  const allContinents: { name: string; held: boolean; bonus: number }[] = [];
  for (const continent of Object.values(gameState.map.continents)) {
    const ownsAll = continent.territoryIds.every(
      (tid) => gameState.map.territories[tid]?.ownerId === playerId
    );
    allContinents.push({ name: continent.name, held: ownsAll, bonus: continent.bonusTroops });
  }
  // Sort: held first, then alphabetical
  allContinents.sort((a, b) => (a.held === b.held ? a.name.localeCompare(b.name) : a.held ? -1 : 1));

  // Reinforcement income
  const continentBonus = allContinents
    .filter((c) => c.held)
    .reduce((sum, c) => sum + c.bonus, 0);
  const income = Math.max(3, Math.floor(territories / 3)) + continentBonus;

  // Threat level
  const threatPct = totalTerritories > 0 ? (territories / totalTerritories) * 100 : 0;
  const threatLabel =
    threatPct > 50 ? "DOMINANT" :
    threatPct > 30 ? "SIGNIFICANT" :
    threatPct > 15 ? "MODERATE" : "MINIMAL";
  const threatColor =
    threatPct > 50 ? "text-red-400" :
    threatPct > 30 ? "text-amber-400" :
    threatPct > 15 ? "text-blue-400" : "text-zinc-500";

  // Player deltas
  const pd = deltas[playerId] ?? { territories: 0, troops: 0 };


  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex flex-col divide-y divide-zinc-800 overflow-auto">
        {/* Territory Control Chart */}
        <div className="w-full shrink-0">
          <div className="px-3 pt-3 pb-0">
            <h4 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest font-mono">
              Territory Control
            </h4>
          </div>
          <TerritoryChart
            history={turnHistory}
            players={gameState.players}
            selectedPlayerId={playerId}
          />
        </div>

        {/* Intelligence Stats */}
        <div className="w-full p-3 shrink-0">
          <h4 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3 font-mono">
            Intelligence
          </h4>
          <div className="space-y-2.5">
            <StatCard
              label="Territories"
              value={territories.toString()}
              delta={pd.territories}
              bar={{ value: territories, max: totalTerritories, color: player.color }}
            />
            <StatCard
              label="Total Forces"
              value={troops.toString()}
              delta={pd.troops}
            />
            <StatCard
              label="Income/Turn"
              value={`+${income}`}
            />
            <div className="pt-0.5">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-[10px] text-zinc-600 font-mono uppercase">
                  Threat Level
                </span>
                <span className={`text-xs font-mono font-bold ${threatColor}`}>
                  {threatLabel}
                </span>
              </div>
              <div className="w-full h-[3px] bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${threatPct}%`, backgroundColor: player.color }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Continental Control */}
        <div className="w-full p-3 shrink-0">
          <h4 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2 font-mono">
            Continental Control
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {allContinents.map((c) => (
              <span
                key={c.name}
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wide border ${
                  c.held
                    ? "text-zinc-200"
                    : "text-zinc-700 border-zinc-800 bg-zinc-900"
                }`}
                style={
                  c.held
                    ? {
                        backgroundColor: `${player.color}20`,
                        borderColor: `${player.color}50`,
                      }
                    : undefined
                }
              >
                {c.name}
                {c.held && (
                  <span className="text-[8px] opacity-60">+{c.bonus}</span>
                )}
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  bar,
}: {
  label: string;
  value: string;
  delta?: number;
  bar?: { value: number; max: number; color: string };
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] text-zinc-600 font-mono uppercase">
          {label}
        </span>
        <div className="flex items-baseline gap-1.5">
          {delta !== undefined && delta !== 0 && (
            <span
              className={`text-[10px] font-mono font-medium ${
                delta > 0 ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {delta > 0 ? `+${delta}` : delta}
            </span>
          )}
          <span className="text-sm text-zinc-200 font-mono font-bold tabular-nums">
            {value}
          </span>
        </div>
      </div>
      {bar && (
        <div className="w-full h-[2px] bg-zinc-900 rounded-full overflow-hidden mt-1">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: bar.max > 0 ? `${(bar.value / bar.max) * 100}%` : "0%",
              backgroundColor: bar.color,
              opacity: 0.6,
            }}
          />
        </div>
      )}
    </div>
  );
}
