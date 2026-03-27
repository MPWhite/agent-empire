"use client";

import type { SerializedGameState, AnalystReport } from "@/lib/types";
import ReportCard from "./ReportCard";

interface PlayerDetailProps {
  playerId: string;
  gameState: SerializedGameState;
  reports: AnalystReport[];
  onClose: () => void;
}

export default function PlayerDetail({
  playerId,
  gameState,
  reports,
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

  // Filter reports that mention this player's name in their text
  const playerName = player.name;
  const relevantReports = reports.filter(
    (r) => r.text.includes(playerName)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 flex items-center justify-between px-3 py-1.5 border-b border-zinc-800 bg-zinc-950 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5"
            style={{ backgroundColor: player.color }}
          />
          <span className="text-xs font-bold font-mono text-zinc-200 uppercase tracking-wide">
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
      <div className="flex-1 flex flex-col divide-y divide-zinc-800 overflow-auto">
        {/* Stats panel */}
        <div className="w-full p-3 shrink-0">
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

        {/* Reports mentioning this player */}
        <div className="overflow-y-auto panel-scroll">
          <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-3 py-1.5 z-10">
            <h4 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest font-mono">
              Coverage
            </h4>
          </div>
          <div>
            {relevantReports.length === 0 && (
              <div className="px-3 py-4 text-zinc-700 text-xs font-mono">
                NO COVERAGE YET
              </div>
            )}
            {relevantReports.map((r) => (
              <ReportCard key={r.id} report={r} />
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
