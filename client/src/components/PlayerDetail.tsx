"use client";

import type { SerializedGameState, Agreement, Sanction } from "@/lib/types";
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

  // Resources
  const resources = player.resources ?? { oil: 0, minerals: 0, food: 0, money: 0 };
  const shortages = player.shortages ?? { oil: 0, minerals: 0, food: 0 };

  // Tech
  const tech = player.tech ?? { military: 0, economic: 0, intelligence: 0 };

  // Reputation
  const reputation = player.reputation ?? 50;

  // Agreements involving this player
  const agreements = (gameState.agreements ?? []).filter(
    (a: Agreement) => a.parties.includes(playerId)
  );
  const sanctionsAgainst = (gameState.sanctions ?? []).filter(
    (s: Sanction) => s.targetPlayerId === playerId
  );
  const sanctionsBy = (gameState.sanctions ?? []).filter(
    (s: Sanction) => s.supporters.includes(playerId)
  );

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

        {/* Resources */}
        <div className="w-full p-3 shrink-0">
          <h4 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3 font-mono">
            Resources
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <ResourceBar icon="🛢" label="Oil" value={resources.oil} shortage={shortages.oil} color="#f97316" />
            <ResourceBar icon="⛏" label="Minerals" value={resources.minerals} shortage={shortages.minerals} color="#a78bfa" />
            <ResourceBar icon="🌾" label="Food" value={resources.food} shortage={shortages.food} color="#34d399" />
            <ResourceBar icon="💰" label="Money" value={resources.money} shortage={0} color="#fbbf24" />
          </div>
          {/* Shortage warnings */}
          {shortages.oil >= 5 && (
            <div className="mt-2 px-2 py-1 bg-red-950/30 border border-red-900/50 text-red-400 text-[10px] font-mono">
              ⚠ Oil critical ({shortages.oil} turns) — cannot attack non-adjacent
            </div>
          )}
          {shortages.oil >= 3 && shortages.oil < 5 && (
            <div className="mt-2 px-2 py-1 bg-amber-950/30 border border-amber-900/50 text-amber-400 text-[10px] font-mono">
              ⚠ Oil shortage ({shortages.oil} turns) — attack power -30%
            </div>
          )}
          {shortages.minerals >= 5 && (
            <div className="mt-2 px-2 py-1 bg-red-950/30 border border-red-900/50 text-red-400 text-[10px] font-mono">
              ⚠ Minerals critical ({shortages.minerals} turns) — research halted
            </div>
          )}
          {shortages.minerals >= 3 && shortages.minerals < 5 && (
            <div className="mt-2 px-2 py-1 bg-amber-950/30 border border-amber-900/50 text-amber-400 text-[10px] font-mono">
              ⚠ Minerals shortage ({shortages.minerals} turns) — research -30%
            </div>
          )}
          {shortages.food >= 5 && (
            <div className="mt-2 px-2 py-1 bg-red-950/30 border border-red-900/50 text-red-400 text-[10px] font-mono">
              ⚠ Food critical ({shortages.food} turns) — rebellion imminent!
            </div>
          )}
          {shortages.food >= 3 && shortages.food < 5 && (
            <div className="mt-2 px-2 py-1 bg-amber-950/30 border border-amber-900/50 text-amber-400 text-[10px] font-mono">
              ⚠ Food shortage ({shortages.food} turns) — recruitment -30%
            </div>
          )}
        </div>

        {/* Technology */}
        <div className="w-full p-3 shrink-0">
          <h4 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-3 font-mono">
            Technology
          </h4>
          <div className="space-y-2">
            <TechBar label="Military" icon="⚔" level={tech.military} color="#ef4444" />
            <TechBar label="Economic" icon="📈" level={tech.economic} color="#60a5fa" />
            <TechBar label="Intelligence" icon="🕵" level={tech.intelligence} color="#a78bfa" />
          </div>
          {tech.military >= 5 && (
            <div className="mt-2 px-2 py-1 bg-red-950/30 border border-red-900/50 text-red-400 text-[10px] font-mono font-bold">
              ☢️ Nuclear capable
            </div>
          )}
          {tech.military === 4 && (
            <div className="mt-2 px-2 py-1 bg-amber-950/30 border border-amber-900/50 text-amber-400 text-[10px] font-mono">
              🚀 Missile capable
            </div>
          )}
        </div>

        {/* Reputation */}
        <div className="w-full p-3 shrink-0">
          <h4 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2 font-mono">
            Reputation
          </h4>
          <div className="flex justify-between items-baseline mb-1">
            <span className="text-[10px] text-zinc-500 font-mono">
              {reputation > 15 ? "Can propose treaties" : "Reputation too low for treaties"}
            </span>
            <span className={`text-xs font-mono font-bold ${
              reputation >= 50 ? "text-emerald-400" :
              reputation >= 15 ? "text-amber-400" : "text-red-400"
            }`}>
              {reputation}/100
            </span>
          </div>
          <div className="w-full h-[3px] bg-zinc-900 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${reputation}%`,
                backgroundColor: reputation >= 50 ? "#34d399" : reputation >= 15 ? "#fbbf24" : "#ef4444",
              }}
            />
          </div>
        </div>

        {/* Agreements & Sanctions */}
        {(agreements.length > 0 || sanctionsAgainst.length > 0 || sanctionsBy.length > 0) && (
          <div className="w-full p-3 shrink-0">
            <h4 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2 font-mono">
              Agreements
            </h4>
            <div className="space-y-1.5">
              {agreements.map((a) => {
                const otherId = a.parties[0] === playerId ? a.parties[1] : a.parties[0];
                const other = gameState.players[otherId];
                const icon = a.type === 'militaryAlliance' ? '🤝' : a.type === 'tradeDeal' ? '📦' : '🕊';
                const color = a.type === 'militaryAlliance' ? 'text-emerald-400' : a.type === 'tradeDeal' ? 'text-blue-400' : 'text-zinc-400';
                const label = a.type === 'militaryAlliance' ? 'Alliance' : a.type === 'tradeDeal' ? 'Trade' : 'NAP';
                return (
                  <div key={a.id} className="text-[11px] font-mono text-zinc-300">
                    {icon} <span className={color}>{label}</span> w/{' '}
                    <span style={{ color: other?.color }}>{other?.name ?? otherId}</span>
                    {a.turnsRemaining != null && (
                      <span className="text-zinc-600 ml-1">({a.turnsRemaining}t)</span>
                    )}
                  </div>
                );
              })}
              {sanctionsAgainst.map((s, i) => (
                <div key={`sa-${i}`} className="text-[11px] font-mono text-red-400">
                  🚫 Sanctioned by {s.supporters.map((sid) => {
                    const p = gameState.players[sid];
                    return p?.name ?? sid;
                  }).join(', ')}
                </div>
              ))}
              {sanctionsBy.map((s, i) => {
                const target = gameState.players[s.targetPlayerId];
                return (
                  <div key={`sb-${i}`} className="text-[11px] font-mono text-amber-400">
                    🚫 Sanctioning <span style={{ color: target?.color }}>{target?.name ?? s.targetPlayerId}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

function ResourceBar({
  icon,
  label,
  value,
  shortage,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  shortage: number;
  color: string;
}) {
  const isWarning = shortage >= 3 && shortage < 5;
  const isCritical = shortage >= 5;
  return (
    <div>
      <div className="flex justify-between items-baseline">
        <span className="text-[10px] text-zinc-500 font-mono">
          {icon} {label}
        </span>
        <span className={`text-[11px] font-mono font-bold ${
          isCritical ? "text-red-400" : isWarning ? "text-amber-400" : "text-zinc-200"
        }`}>
          {value}/50
        </span>
      </div>
      <div className="w-full h-[2px] bg-zinc-900 rounded-full overflow-hidden mt-0.5">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(value / 50) * 100}%`, backgroundColor: color, opacity: 0.6 }}
        />
      </div>
    </div>
  );
}

function TechBar({
  label,
  icon,
  level,
  color,
}: {
  label: string;
  icon: string;
  level: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-0.5">
        <span className="text-[10px] text-zinc-500 font-mono">
          {icon} {label}
        </span>
        <span className="text-[11px] font-mono font-bold" style={{ color }}>
          Lv {level}
        </span>
      </div>
      <div className="w-full h-[3px] bg-zinc-900 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${(level / 5) * 100}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
