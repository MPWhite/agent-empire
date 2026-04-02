import type { BattleEvent, GameState, Territory, Agreement } from './types.js';
import {
  FORT_DEFENSE_BONUS,
  MOUNTAIN_DEFENSE_BONUS,
  ALLIANCE_DEFENSE_RATIO,
  PACT_BREAKER_ATTACK_PENALTY,
} from './types.js';
import { getNeighbors } from './map.js';

/**
 * Deterministic combat resolution based on troop ratio.
 *
 * The attacker/defender strength multipliers are looked up from a table
 * based on the ratio of attackers to defenders. Higher ratios favor the
 * attacker; lower ratios favor the defender.
 */

export interface CombatResult {
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

/**
 * Basic combat resolution (no modifiers). Used internally.
 */
export function resolveCombat(
  attackerTroops: number,
  defenderTroops: number,
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

/**
 * Combat modifiers for the v2 system.
 */
export interface CombatModifiers {
  fortLevel: number;           // 0-3, each level adds FORT_DEFENSE_BONUS
  isMountain: boolean;         // +MOUNTAIN_DEFENSE_BONUS to defense
  artilleryAttack: boolean;    // attacker has Artillery tech — reduces fort by 1
  allianceDefenseTroops: number; // extra troops from allied neighbors
  pactBreakerAttack: boolean;  // attacker broke a NAP recently — -20% attack
}

/**
 * Resolve combat with all v2 modifiers applied.
 */
export function resolveCombatWithModifiers(
  attackerTroops: number,
  defenderTroops: number,
  modifiers: CombatModifiers,
): CombatResult & { effectiveFortLevel: number } {
  // Apply pact-breaker penalty to attacker
  let effectiveAttackerTroops = attackerTroops;
  if (modifiers.pactBreakerAttack) {
    effectiveAttackerTroops = Math.max(1, Math.floor(attackerTroops * (1 - PACT_BREAKER_ATTACK_PENALTY)));
  }

  // Calculate effective fort level (artillery reduces by 1)
  let effectiveFortLevel = modifiers.fortLevel;
  if (modifiers.artilleryAttack && effectiveFortLevel > 0) {
    effectiveFortLevel--;
  }

  // Calculate defense bonus multiplier
  let defenseMultiplier = 1.0;
  defenseMultiplier += effectiveFortLevel * FORT_DEFENSE_BONUS;
  if (modifiers.isMountain) {
    defenseMultiplier += MOUNTAIN_DEFENSE_BONUS;
  }

  // Effective defender troops = actual troops + alliance troops, scaled by defense multiplier
  const totalDefenderTroops = defenderTroops + modifiers.allianceDefenseTroops;
  const effectiveDefenderTroops = Math.ceil(totalDefenderTroops * defenseMultiplier);

  // Resolve with effective values
  const ratio = effectiveAttackerTroops / effectiveDefenderTroops;
  const { attackerStrength, defenderStrength } = getStrengths(ratio);

  // Losses are calculated against actual troop counts, not effective
  const defenderLosses = Math.min(totalDefenderTroops, Math.ceil(totalDefenderTroops * attackerStrength));
  const attackerLosses = Math.floor(attackerTroops * defenderStrength);

  const defendersRemaining = totalDefenderTroops - defenderLosses;
  const attackersRemaining = attackerTroops - attackerLosses;
  const conquered = defendersRemaining <= 0 && attackersRemaining > 0;

  return {
    attackerLosses,
    defenderLosses,
    conquered,
    effectiveFortLevel,
  };
}

/**
 * Calculate alliance defense troops for a territory.
 * Allied neighbors contribute ALLIANCE_DEFENSE_RATIO of their troops.
 */
export function calculateAllianceDefense(
  state: GameState,
  territory: Territory,
  agreements: Agreement[],
): number {
  if (!territory.ownerId) return 0;

  // Find all military alliances for the defending player
  const alliances = agreements.filter(
    (a) => a.type === 'militaryAlliance' && a.parties.includes(territory.ownerId!),
  );
  if (alliances.length === 0) return 0;

  const alliedPlayers = new Set<string>();
  for (const alliance of alliances) {
    const ally = alliance.parties[0] === territory.ownerId ? alliance.parties[1] : alliance.parties[0];
    alliedPlayers.add(ally);
  }

  // Sum troops from adjacent allied territories
  let allianceTroops = 0;
  const neighborIds = getNeighbors(state.map, territory.id);
  for (const neighborId of neighborIds) {
    const neighbor = state.map.territories.get(neighborId);
    if (neighbor && neighbor.ownerId && alliedPlayers.has(neighbor.ownerId)) {
      allianceTroops += Math.floor(neighbor.troops * ALLIANCE_DEFENSE_RATIO);
    }
  }

  return allianceTroops;
}

export function createBattleEvent(
  attackerId: string,
  defenderId: string,
  fromTerritoryId: string,
  toTerritoryId: string,
  attackerTroops: number,
  defenderTroops: number,
  result: CombatResult,
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
