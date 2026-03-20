import type { GameState, PlayerAction, AttackAction, ReinforceAction } from './types.js';
import { areAdjacent } from './map.js';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateAction(state: GameState, action: PlayerAction): ValidationResult {
  const player = state.map.territories;

  if (action.type === 'attack') {
    return validateAttack(state, action);
  } else {
    return validateReinforce(state, action);
  }
}

function validateAttack(state: GameState, action: AttackAction): ValidationResult {
  const from = state.map.territories.get(action.fromTerritoryId);
  const to = state.map.territories.get(action.toTerritoryId);

  if (!from) return { valid: false, reason: `Source territory ${action.fromTerritoryId} does not exist` };
  if (!to) return { valid: false, reason: `Target territory ${action.toTerritoryId} does not exist` };
  if (from.ownerId !== action.playerId) return { valid: false, reason: 'Player does not own source territory' };
  if (to.ownerId === action.playerId) return { valid: false, reason: 'Cannot attack own territory' };
  if (to.ownerId === null) return { valid: false, reason: 'Target territory is unowned' };
  if (!areAdjacent(state.map, action.fromTerritoryId, action.toTerritoryId)) {
    return { valid: false, reason: 'Territories are not adjacent' };
  }
  if (action.troops < 1) return { valid: false, reason: 'Must attack with at least 1 troop' };
  if (action.troops >= from.troops) return { valid: false, reason: 'Must leave at least 1 troop behind' };

  return { valid: true };
}

function validateReinforce(state: GameState, action: ReinforceAction): ValidationResult {
  const territory = state.map.territories.get(action.territoryId);

  if (!territory) return { valid: false, reason: `Territory ${action.territoryId} does not exist` };
  if (territory.ownerId !== action.playerId) return { valid: false, reason: 'Player does not own territory' };
  if (action.troops < 1) return { valid: false, reason: 'Must reinforce with at least 1 troop' };

  return { valid: true };
}

/**
 * Validate an attack against the *current* state during resolution.
 * The source may have lost troops from earlier battles in the same turn.
 */
export function validateAttackDuringResolution(state: GameState, action: AttackAction): ValidationResult {
  const from = state.map.territories.get(action.fromTerritoryId);
  const to = state.map.territories.get(action.toTerritoryId);

  if (!from || !to) return { valid: false, reason: 'Territory does not exist' };
  if (from.ownerId !== action.playerId) return { valid: false, reason: 'Player no longer owns source territory' };
  if (to.ownerId === action.playerId) return { valid: false, reason: 'Player now owns target territory' };
  if (to.ownerId === null) return { valid: false, reason: 'Target territory is unowned' };
  if (!areAdjacent(state.map, action.fromTerritoryId, action.toTerritoryId)) {
    return { valid: false, reason: 'Territories are not adjacent' };
  }
  // Check against current troop count (may have changed)
  const availableTroops = from.troops - 1; // must leave 1 behind
  if (availableTroops < 1) return { valid: false, reason: 'Not enough troops remaining' };

  return { valid: true };
}
