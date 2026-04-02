import type { GameState, LaunchMissileAction, MissileStrikeEvent } from '../types.js';
import {
  MISSILE_RANGE,
  MISSILE_TROOP_KILL_RATIO,
  MISSILE_OIL_COST,
  MISSILE_MINERAL_COST,
} from '../types.js';

/**
 * Check if a territory is within missile range (MISSILE_RANGE hops)
 * from any territory owned by the player.
 */
export function isInMissileRange(state: GameState, playerId: string, targetId: string): boolean {
  // BFS from all player territories, up to MISSILE_RANGE hops
  const visited = new Set<string>();
  let frontier = new Set<string>();

  for (const [id, t] of state.map.territories) {
    if (t.ownerId === playerId) {
      frontier.add(id);
      visited.add(id);
    }
  }

  for (let depth = 0; depth < MISSILE_RANGE; depth++) {
    const nextFrontier = new Set<string>();
    for (const territoryId of frontier) {
      const neighbors = state.map.adjacency.get(territoryId);
      if (!neighbors) continue;
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          nextFrontier.add(neighbor);
          if (neighbor === targetId) return true;
        }
      }
    }
    frontier = nextFrontier;
  }

  return visited.has(targetId);
}

/**
 * Validate a missile launch action.
 */
export function validateMissile(state: GameState, action: LaunchMissileAction): { valid: boolean; reason?: string } {
  const player = state.players.get(action.playerId);
  if (!player) return { valid: false, reason: 'Player not found' };
  if (!player.isAlive) return { valid: false, reason: 'Player is eliminated' };

  // Requires Military Tech 4+
  if (player.tech.military < 4) return { valid: false, reason: 'Requires Military Tech level 4 (Missiles)' };

  // Check resources
  if (player.resources.oil < MISSILE_OIL_COST) return { valid: false, reason: `Requires ${MISSILE_OIL_COST} oil` };
  if (player.resources.minerals < MISSILE_MINERAL_COST) return { valid: false, reason: `Requires ${MISSILE_MINERAL_COST} minerals` };

  // Check target exists
  const target = state.map.territories.get(action.targetTerritoryId);
  if (!target) return { valid: false, reason: 'Target territory does not exist' };

  // Can't missile your own territory
  if (target.ownerId === action.playerId) return { valid: false, reason: 'Cannot target own territory' };

  // Check range
  if (!isInMissileRange(state, action.playerId, action.targetTerritoryId)) {
    return { valid: false, reason: `Target out of missile range (max ${MISSILE_RANGE} hops)` };
  }

  return { valid: true };
}

/**
 * Resolve a missile strike. Modifies state in place.
 * Returns the event.
 */
export function resolveMissile(state: GameState, action: LaunchMissileAction): MissileStrikeEvent | null {
  const validation = validateMissile(state, action);
  if (!validation.valid) return null;

  const player = state.players.get(action.playerId)!;
  const target = state.map.territories.get(action.targetTerritoryId)!;

  // Deduct resources
  player.resources.oil -= MISSILE_OIL_COST;
  player.resources.minerals -= MISSILE_MINERAL_COST;

  // Apply damage
  const troopsDestroyed = Math.ceil(target.troops * MISSILE_TROOP_KILL_RATIO);
  target.troops = Math.max(1, target.troops - troopsDestroyed);

  // Reduce fort level by 1
  let fortReduced = false;
  if (target.fortLevel > 0) {
    target.fortLevel--;
    fortReduced = true;
  }

  return {
    type: 'missileStrike',
    attackerId: action.playerId,
    targetTerritoryId: action.targetTerritoryId,
    troopsDestroyed,
    fortReduced,
  };
}
