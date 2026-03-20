import type { BattleEvent } from './types.js';

/**
 * Deterministic combat resolution based on troop ratio.
 *
 * The attacker/defender strength multipliers are looked up from a table
 * based on the ratio of attackers to defenders. Higher ratios favor the
 * attacker; lower ratios favor the defender.
 */

interface CombatResult {
  attackerLosses: number;
  defenderLosses: number;
  conquered: boolean;
}

// Ratio brackets: [minRatio, attackerStrength, defenderStrength]
// attackerStrength = fraction of defenders killed
// defenderStrength = fraction of attackers killed
const COMBAT_TABLE: [number, number, number][] = [
  [5.0, 0.9, 0.1],  // 5:1+ — overwhelming attacker advantage
  [3.0, 0.7, 0.2],  // 3:1+ — strong attacker advantage
  [2.0, 0.6, 0.3],  // 2:1
  [1.5, 0.5, 0.35], // 1.5:1
  [1.0, 0.4, 0.4],  // 1:1 — even
  [0.5, 0.3, 0.5],  // 1:2 — defender advantage
  [0.0, 0.2, 0.6],  // below 1:2 — strong defender advantage
];

function getStrengths(ratio: number): { attackerStrength: number; defenderStrength: number } {
  for (const [minRatio, attackerStr, defenderStr] of COMBAT_TABLE) {
    if (ratio >= minRatio) {
      return { attackerStrength: attackerStr, defenderStrength: defenderStr };
    }
  }
  // Fallback (should not reach)
  return { attackerStrength: 0.2, defenderStrength: 0.6 };
}

export function resolveCombat(
  attackerTroops: number,
  defenderTroops: number
): CombatResult {
  const ratio = attackerTroops / defenderTroops;
  const { attackerStrength, defenderStrength } = getStrengths(ratio);

  // Ceil for defender losses ensures conquest is possible at high ratios
  const defenderLosses = Math.min(defenderTroops, Math.ceil(defenderTroops * attackerStrength));
  const attackerLosses = Math.floor(attackerTroops * defenderStrength);

  const defendersRemaining = defenderTroops - defenderLosses;
  const attackersRemaining = attackerTroops - attackerLosses;

  // Territory is conquered if all defenders are eliminated and attackers survive
  const conquered = defendersRemaining <= 0 && attackersRemaining > 0;

  return {
    attackerLosses,
    defenderLosses,
    conquered,
  };
}

export function createBattleEvent(
  attackerId: string,
  defenderId: string,
  fromTerritoryId: string,
  toTerritoryId: string,
  attackerTroops: number,
  defenderTroops: number,
  result: CombatResult
): BattleEvent {
  return {
    type: 'battle',
    attackerId,
    defenderId,
    fromTerritoryId,
    toTerritoryId,
    attackerTroops,
    defenderTroops,
    attackerLosses: result.attackerLosses,
    defenderLosses: result.defenderLosses,
    conquered: result.conquered,
  };
}
