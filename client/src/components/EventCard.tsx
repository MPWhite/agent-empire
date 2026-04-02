"use client";

import type {
  GameEvent,
  Player,
  BattleEvent,
  ConquestEvent,
  ReinforcementEvent,
  EliminationEvent,
  VictoryEvent,
  ResearchEvent,
  MissileStrikeEvent,
  NukeEvent,
  DiplomacyEvent,
  SpyEvent,
  ShortageEvent,
} from "@/lib/types";

interface EventCardProps {
  event: GameEvent;
  turnNumber: number;
  players: Record<string, Player>;
  territories: Record<string, { name: string }>;
}

const EVENT_STYLES: Record<string, { icon: string; label: string; borderColor: string; labelColor: string }> = {
  nuke: { icon: '☢️', label: 'Nuclear Strike', borderColor: '#fbbf24', labelColor: '#fbbf24' },
  missileStrike: { icon: '🚀', label: 'Missile Strike', borderColor: '#f97316', labelColor: '#f97316' },
  spyEvent: { icon: '🕵️', label: 'Espionage', borderColor: '#a78bfa', labelColor: '#a78bfa' },
  diplomacyEvent: { icon: '🤝', label: 'Diplomacy', borderColor: '#34d399', labelColor: '#34d399' },
  research: { icon: '🔬', label: 'Research', borderColor: '#60a5fa', labelColor: '#60a5fa' },
  battle: { icon: '⚔️', label: 'Battle', borderColor: '#71717a', labelColor: '#a1a1aa' },
  conquest: { icon: '🏴', label: 'Conquest', borderColor: '#71717a', labelColor: '#a1a1aa' },
  reinforcement: { icon: '📦', label: 'Reinforcement', borderColor: '#52525b', labelColor: '#71717a' },
  shortage: { icon: '⚠️', label: 'Shortage', borderColor: '#eab308', labelColor: '#eab308' },
  elimination: { icon: '💀', label: 'Elimination', borderColor: '#ef4444', labelColor: '#ef4444' },
  victory: { icon: '🏆', label: 'Victory', borderColor: '#fbbf24', labelColor: '#fbbf24' },
};

function pname(players: Record<string, Player>, id: string): { name: string; color: string } {
  const p = players[id];
  return p ? { name: p.name, color: p.color } : { name: id, color: '#888' };
}

function tname(territories: Record<string, { name: string }>, id: string): string {
  return territories[id]?.name ?? id;
}

function PlayerName({ players, id }: { players: Record<string, Player>; id: string }) {
  const p = pname(players, id);
  return <span style={{ color: p.color }} className="font-bold">{p.name}</span>;
}

export default function EventCard({ event, turnNumber, players, territories }: EventCardProps) {
  const style = EVENT_STYLES[event.type] ?? { icon: '📋', label: event.type, borderColor: '#52525b', labelColor: '#71717a' };

  // Skip noisy events
  if (event.type === 'resourceProduction') return null;

  let description: React.ReactNode = null;

  switch (event.type) {
    case 'battle': {
      const e = event as BattleEvent;
      description = (
        <>
          <PlayerName players={players} id={e.attackerId} /> attacked{' '}
          <strong>{tname(territories, e.toTerritoryId)}</strong>{' '}
          ({e.attackerTroops}v{e.defenderTroops}) — {e.conquered ? 'conquered' : 'repelled'}.{' '}
          <span className="text-zinc-600">Lost {e.attackerLosses}, killed {e.defenderLosses}.</span>
        </>
      );
      break;
    }
    case 'conquest': {
      const e = event as ConquestEvent;
      description = (
        <>
          <PlayerName players={players} id={e.playerId} /> captured{' '}
          <strong>{tname(territories, e.territoryId)}</strong> ({e.troopsMoved} troops moved in).
        </>
      );
      break;
    }
    case 'reinforcement': {
      const e = event as ReinforcementEvent;
      description = (
        <>
          <PlayerName players={players} id={e.playerId} /> reinforced{' '}
          <strong>{tname(territories, e.territoryId)}</strong> with {e.troops} troops.
        </>
      );
      break;
    }
    case 'elimination': {
      const e = event as EliminationEvent;
      description = (
        <>
          <PlayerName players={players} id={e.playerId} /> has been{' '}
          <span className="text-red-400 font-bold">eliminated</span> by{' '}
          <PlayerName players={players} id={e.eliminatedBy} />.
        </>
      );
      break;
    }
    case 'victory': {
      const e = event as VictoryEvent;
      const reason = e.reason === 'elimination' ? 'total conquest' : e.reason === 'dominance' ? 'territorial dominance' : 'time limit';
      description = (
        <>
          <PlayerName players={players} id={e.playerId} />{' '}
          <span className="text-amber-400 font-bold">wins</span> by {reason}!
        </>
      );
      break;
    }
    case 'research': {
      const e = event as ResearchEvent;
      const branchLabel = e.branch.charAt(0).toUpperCase() + e.branch.slice(1);
      description = (
        <>
          <PlayerName players={players} id={e.playerId} /> reached{' '}
          <span className="font-bold" style={{ color: style.borderColor }}>{branchLabel} Tech {e.newLevel}</span>
          {e.branch === 'military' && e.newLevel === 5 && ' — nuclear capability unlocked ☢️'}
          {e.branch === 'military' && e.newLevel === 4 && ' — missile capability unlocked 🚀'}
        </>
      );
      break;
    }
    case 'missileStrike': {
      const e = event as MissileStrikeEvent;
      description = (
        <>
          <PlayerName players={players} id={e.attackerId} /> struck{' '}
          <strong>{tname(territories, e.targetTerritoryId)}</strong> — {e.troopsDestroyed} troops destroyed
          {e.fortReduced && ', fort reduced'}.
        </>
      );
      break;
    }
    case 'nuke': {
      const e = event as NukeEvent;
      description = (
        <>
          <PlayerName players={players} id={e.attackerId} /> launched nuclear strike on{' '}
          <strong>{tname(territories, e.targetTerritoryId)}</strong>.{' '}
          {e.primaryTroopsDestroyed} troops destroyed. {e.collateralTerritories.length > 0 && (
            <span className="text-zinc-500">Collateral to {e.collateralTerritories.length} adjacent territories.</span>
          )}
          {e.retaliations.length > 0 && (
            <div className="mt-1 px-2 py-1 bg-red-950/30 border border-red-900/50 text-red-400 text-[10px]">
              ⚡ MAD TRIGGERED — {e.retaliations.map((r) => {
                const p = pname(players, r.playerId);
                return <span key={r.playerId}><span style={{ color: p.color }}>{p.name}</span> retaliating against {tname(territories, r.targetTerritoryId)}. </span>;
              })}
            </div>
          )}
        </>
      );
      break;
    }
    case 'diplomacyEvent': {
      const e = event as DiplomacyEvent;
      const subtypeLabels: Record<string, string> = {
        agreementFormed: 'Treaty Formed',
        agreementBroken: 'Treaty Broken',
        sanctionImposed: 'Sanction Imposed',
        sanctionLifted: 'Sanction Lifted',
        resolutionPassed: 'Resolution Passed',
        resolutionFailed: 'Resolution Failed',
      };
      style.label = subtypeLabels[e.subtype] ?? 'Diplomacy';
      description = (
        <>
          <PlayerName players={players} id={e.playerId} />
          {e.targetPlayerId && <> and <PlayerName players={players} id={e.targetPlayerId} /></>}
          {' — '}{e.details ?? e.subtype}
        </>
      );
      break;
    }
    case 'spyEvent': {
      const e = event as SpyEvent;
      const subtypeLabels: Record<string, string> = {
        intelGathered: 'Intel gathered',
        sabotageSuccess: 'Sabotage successful',
        sabotageFailed: 'Sabotage failed',
        techStolen: 'Technology stolen',
        spyDetected: 'Spy detected',
      };
      description = (
        <>
          <PlayerName players={players} id={e.attackerId} />{' '}
          {subtypeLabels[e.subtype] ?? e.subtype} targeting{' '}
          <PlayerName players={players} id={e.targetId} />
          {e.details && <span className="text-zinc-500"> — {e.details}</span>}
        </>
      );
      break;
    }
    case 'shortage': {
      const e = event as ShortageEvent;
      const effectLabel = e.effect === 'critical' ? 'CRITICAL' : e.effect === 'penalty' ? 'penalty' : 'warning';
      description = (
        <>
          <PlayerName players={players} id={e.playerId} /> {e.resource} shortage{' '}
          <span className={e.effect === 'critical' ? 'text-red-400 font-bold' : 'text-amber-400'}>
            {effectLabel}
          </span>{' '}
          ({e.consecutiveTurns} turns)
          {e.effect === 'critical' && e.resource === 'food' && ' — territory rebellion imminent!'}
        </>
      );
      break;
    }
  }

  if (!description) return null;

  return (
    <div
      className="border-t border-zinc-800/50"
      style={{ borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: style.borderColor }}
    >
      <div className="px-3 py-2" style={{ backgroundColor: `${style.borderColor}06` }}>
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-xs">{style.icon}</span>
          <span
            className="text-[10px] font-mono font-bold uppercase tracking-wider"
            style={{ color: style.labelColor }}
          >
            {style.label}
          </span>
          <span className="text-[9px] font-mono text-zinc-600 ml-auto">
            Turn {turnNumber}
          </span>
        </div>
        <div className="text-[11px] font-mono text-zinc-300 leading-relaxed">
          {description}
        </div>
      </div>
    </div>
  );
}
