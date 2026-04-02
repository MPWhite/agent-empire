import type { GameState, LaunchNukeAction, NukeEvent } from '../types.js';
import {
  NUKE_OIL_COST,
  NUKE_MINERAL_COST,
  NUKE_PRIMARY_KILL_RATIO,
  NUKE_COLLATERAL_KILL_RATIO,
  NUKE_FALLOUT_TURNS,
  NUKE_WAR_ECONOMY_TURNS,
  NUKE_WAR_ECONOMY_MULTIPLIER,
} from '../types.js';
import { getNeighbors } from '../map.js';

/**
 * Validate a nuclear launch.
 */
export function validateNuke(state: GameState, action: LaunchNukeAction): { valid: boolean; reason?: string } {
  const player = state.players.get(action.playerId);
  if (!player) return { valid: false, reason: 'Player not found' };
  if (!player.isAlive) return { valid: false, reason: 'Player is eliminated' };

  // Requires Military Tech 5
  if (player.tech.military < 5) return { valid: false, reason: 'Requires Military Tech level 5 (Nuclear Weapons)' };

  // Check resources
  if (player.resources.oil < NUKE_OIL_COST) return { valid: false, reason: `Requires ${NUKE_OIL_COST} oil` };
  if (player.resources.minerals < NUKE_MINERAL_COST) return { valid: false, reason: `Requires ${NUKE_MINERAL_COST} minerals` };

  // Check target exists
  const target = state.map.territories.get(action.targetTerritoryId);
  if (!target) return { valid: false, reason: 'Target territory does not exist' };

  // Can't nuke your own territory
  if (target.ownerId === action.playerId) return { valid: false, reason: 'Cannot target own territory' };

  return { valid: true };
}

/**
 * Resolve a nuclear strike with MAD retaliation.
 * Modifies state in place. Returns the event.
 */
export function resolveNuke(state: GameState, action: LaunchNukeAction): NukeEvent | null {
  const validation = validateNuke(state, action);
  if (!validation.valid) return null;

  const attacker = state.players.get(action.playerId)!;
  const target = state.map.territories.get(action.targetTerritoryId)!;

  // Deduct resources
  attacker.resources.oil -= NUKE_OIL_COST;
  attacker.resources.minerals -= NUKE_MINERAL_COST;

  // 1. Primary damage: 80% troops destroyed in target
  const primaryDestroyed = Math.ceil(target.troops * NUKE_PRIMARY_KILL_RATIO);
  target.troops = Math.max(0, target.troops - primaryDestroyed);
  target.fortLevel = 0; // All fortifications destroyed
  target.falloutTurns = NUKE_FALLOUT_TURNS;

  // 2. Collateral damage: 30% troops in adjacent territories
  const collateralTerritories: string[] = [];
  const neighborIds = getNeighbors(state.map, action.targetTerritoryId);
  for (const neighborId of neighborIds) {
    const neighbor = state.map.territories.get(neighborId);
    if (neighbor && neighbor.troops > 0) {
      const collateralLoss = Math.ceil(neighbor.troops * NUKE_COLLATERAL_KILL_RATIO);
      neighbor.troops = Math.max(1, neighbor.troops - collateralLoss);
      collateralTerritories.push(neighborId);
    }
  }

  // 3. MAD Retaliation: all other nuclear-armed empires auto-strike back
  const retaliations: NukeEvent['retaliations'] = [];
  for (const [playerId, player] of state.players) {
    if (playerId === action.playerId) continue;
    if (!player.isAlive) continue;
    if (player.tech.military < 5) continue; // Not nuclear-armed

    // Find attacker's most-populated territory
    let bestTerritory: { id: string; troops: number } | null = null;
    for (const [id, t] of state.map.territories) {
      if (t.ownerId === action.playerId) {
        if (!bestTerritory || t.troops > bestTerritory.troops) {
          bestTerritory = { id, troops: t.troops };
        }
      }
    }

    if (bestTerritory) {
      const retaliationTarget = state.map.territories.get(bestTerritory.id)!;
      const retaliationDestroyed = Math.ceil(retaliationTarget.troops * NUKE_PRIMARY_KILL_RATIO);
      retaliationTarget.troops = Math.max(0, retaliationTarget.troops - retaliationDestroyed);
      retaliationTarget.fortLevel = 0;
      retaliationTarget.falloutTurns = NUKE_FALLOUT_TURNS;

      // Collateral from retaliation too
      const retNeighbors = getNeighbors(state.map, bestTerritory.id);
      for (const nId of retNeighbors) {
        const n = state.map.territories.get(nId);
        if (n && n.troops > 0) {
          const loss = Math.ceil(n.troops * NUKE_COLLATERAL_KILL_RATIO);
          n.troops = Math.max(1, n.troops - loss);
        }
      }

      retaliations.push({
        playerId,
        targetTerritoryId: bestTerritory.id,
        troopsDestroyed: retaliationDestroyed,
      });
    }
  }

  // 4. Diplomatic consequences
  // Attacker's reputation drops to 0
  attacker.reputation = 0;

  // All existing agreements with the attacker are broken
  state.agreements = state.agreements.filter(
    (a) => !a.parties.includes(action.playerId),
  );

  // Non-nuclear empires get war economy boost (handled in resource production via event)
  // We add a synthetic event for this
  state.events.push({
    id: `nuke-war-economy-${state.turnNumber}`,
    type: 'armsRace', // reuse for war economy tracking
    name: 'War Economy',
    description: 'Non-nuclear empires receive double resource production.',
    announcedAtTurn: state.turnNumber,
    activeAtTurn: state.turnNumber,
    durationTurns: NUKE_WAR_ECONOMY_TURNS,
    turnsRemaining: NUKE_WAR_ECONOMY_TURNS,
    details: { attackerPlayerId: action.playerId },
  });

  return {
    type: 'nuke',
    attackerId: action.playerId,
    targetTerritoryId: action.targetTerritoryId,
    primaryTroopsDestroyed: primaryDestroyed,
    collateralTerritories,
    retaliations,
  };
}
