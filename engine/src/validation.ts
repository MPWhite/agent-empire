import type {
  GameState,
  PlayerAction,
  AttackAction,
  ReinforceAction,
  ResearchAction,
  BuildFortAction,
  LaunchMissileAction,
  LaunchNukeAction,
  TradeAction,
  SanctionAction,
  SpyAction,
  CyberattackAction,
  DiplomacyAction,
} from './types.js';
import { MAX_FORT_LEVEL, FORT_MINERAL_COST, MAX_TECH_LEVEL } from './types.js';
import { areAdjacent } from './map.js';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateAction(state: GameState, action: PlayerAction): ValidationResult {
  switch (action.type) {
    case 'attack': return validateAttack(state, action);
    case 'reinforce': return validateReinforce(state, action);
    case 'research': return validateResearch(state, action);
    case 'buildFort': return validateBuildFort(state, action);
    case 'launchMissile': return validateMissileBasic(state, action);
    case 'launchNuke': return validateNukeBasic(state, action);
    case 'trade': return validateTrade(state, action);
    case 'sanction': return validateSanction(state, action);
    case 'spy': return validateSpyBasic(state, action);
    case 'cyberattack': return validateCyberBasic(state, action);
    case 'diplomacy': return validateDiplomacy(state, action);
    default: return { valid: false, reason: 'Unknown action type' };
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

  // Check adjacency — or oil-powered non-adjacent attack
  const adjacent = areAdjacent(state.map, action.fromTerritoryId, action.toTerritoryId);
  if (!adjacent) {
    // Non-adjacent attacks require oil
    const player = state.players.get(action.playerId);
    if (!player || player.resources.oil < 1) {
      return { valid: false, reason: 'Non-adjacent attack requires oil' };
    }
    // Check within 2 hops
    const neighbors = state.map.adjacency.get(action.fromTerritoryId);
    if (!neighbors) return { valid: false, reason: 'Territories are not within range' };
    let within2Hops = false;
    for (const n of neighbors) {
      if (state.map.adjacency.get(n)?.has(action.toTerritoryId)) {
        within2Hops = true;
        break;
      }
    }
    if (!within2Hops) return { valid: false, reason: 'Target territory is beyond 2-hop attack range' };
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

function validateResearch(state: GameState, action: ResearchAction): ValidationResult {
  const player = state.players.get(action.playerId);
  if (!player) return { valid: false, reason: 'Player not found' };

  if (!['military', 'economic', 'intelligence'].includes(action.branch)) {
    return { valid: false, reason: 'Invalid tech branch' };
  }

  if (player.tech[action.branch] >= MAX_TECH_LEVEL) {
    return { valid: false, reason: `Already at max level in ${action.branch}` };
  }

  if (action.investment < 1) return { valid: false, reason: 'Must invest at least 1' };

  // Check can afford (1 mineral + 1 money per research point)
  if (player.resources.minerals < action.investment) return { valid: false, reason: 'Not enough minerals' };
  if (player.resources.money < action.investment) return { valid: false, reason: 'Not enough money' };

  return { valid: true };
}

function validateBuildFort(state: GameState, action: BuildFortAction): ValidationResult {
  const player = state.players.get(action.playerId);
  if (!player) return { valid: false, reason: 'Player not found' };

  if (player.tech.military < 1) return { valid: false, reason: 'Requires Military Tech level 1 (Fortifications)' };

  const territory = state.map.territories.get(action.territoryId);
  if (!territory) return { valid: false, reason: 'Territory not found' };
  if (territory.ownerId !== action.playerId) return { valid: false, reason: 'Player does not own territory' };
  if (territory.fortLevel >= MAX_FORT_LEVEL) return { valid: false, reason: `Fort already at max level ${MAX_FORT_LEVEL}` };

  if (player.resources.minerals < FORT_MINERAL_COST) return { valid: false, reason: `Requires ${FORT_MINERAL_COST} minerals` };

  return { valid: true };
}

function validateMissileBasic(state: GameState, action: LaunchMissileAction): ValidationResult {
  const player = state.players.get(action.playerId);
  if (!player) return { valid: false, reason: 'Player not found' };
  if (player.tech.military < 4) return { valid: false, reason: 'Requires Military Tech level 4' };
  return { valid: true };
}

function validateNukeBasic(state: GameState, action: LaunchNukeAction): ValidationResult {
  const player = state.players.get(action.playerId);
  if (!player) return { valid: false, reason: 'Player not found' };
  if (player.tech.military < 5) return { valid: false, reason: 'Requires Military Tech level 5' };
  return { valid: true };
}

function validateTrade(state: GameState, action: TradeAction): ValidationResult {
  const player = state.players.get(action.playerId);
  if (!player) return { valid: false, reason: 'Player not found' };
  if (player.tech.economic < 1) return { valid: false, reason: 'Requires Economic Tech level 1 (Trade Networks)' };

  const target = state.players.get(action.targetPlayerId);
  if (!target) return { valid: false, reason: 'Target player not found' };
  if (action.targetPlayerId === action.playerId) return { valid: false, reason: 'Cannot trade with yourself' };

  // Check player has the offered resources
  if (player.resources[action.offer.resource] < action.offer.amount) {
    return { valid: false, reason: `Not enough ${action.offer.resource} to offer` };
  }

  return { valid: true };
}

function validateSanction(state: GameState, action: SanctionAction): ValidationResult {
  const player = state.players.get(action.playerId);
  if (!player) return { valid: false, reason: 'Player not found' };
  if (player.tech.economic < 3) return { valid: false, reason: 'Requires Economic Tech level 3 (Sanctions)' };

  const target = state.players.get(action.targetPlayerId);
  if (!target) return { valid: false, reason: 'Target player not found' };
  if (action.targetPlayerId === action.playerId) return { valid: false, reason: 'Cannot sanction yourself' };

  return { valid: true };
}

function validateSpyBasic(state: GameState, action: SpyAction): ValidationResult {
  const player = state.players.get(action.playerId);
  if (!player) return { valid: false, reason: 'Player not found' };
  if (player.tech.intelligence < 2) return { valid: false, reason: 'Requires Intelligence Tech level 2' };
  return { valid: true };
}

function validateCyberBasic(state: GameState, action: CyberattackAction): ValidationResult {
  const player = state.players.get(action.playerId);
  if (!player) return { valid: false, reason: 'Player not found' };
  if (player.tech.intelligence < 4) return { valid: false, reason: 'Requires Intelligence Tech level 4' };
  return { valid: true };
}

function validateDiplomacy(state: GameState, action: DiplomacyAction): ValidationResult {
  const player = state.players.get(action.playerId);
  if (!player) return { valid: false, reason: 'Player not found' };

  // Messages always available but cost money
  if (action.diplomacyType === 'message') {
    // Cost checked during resolution
    return { valid: true };
  }

  // Treaty proposals need reputation > 15
  if (action.diplomacyType === 'proposeTreaty') {
    if (player.reputation <= 15) {
      return { valid: false, reason: 'Reputation too low to propose treaties (need > 15)' };
    }
  }

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

  // Check adjacency or 2-hop range
  if (!areAdjacent(state.map, action.fromTerritoryId, action.toTerritoryId)) {
    const neighbors = state.map.adjacency.get(action.fromTerritoryId);
    if (!neighbors) return { valid: false, reason: 'Not adjacent and no path' };
    let within2Hops = false;
    for (const n of neighbors) {
      if (state.map.adjacency.get(n)?.has(action.toTerritoryId)) {
        within2Hops = true;
        break;
      }
    }
    if (!within2Hops) return { valid: false, reason: 'Target out of range' };
  }

  // Check against current troop count (may have changed)
  const availableTroops = from.troops - 1; // must leave 1 behind
  if (availableTroops < 1) return { valid: false, reason: 'Not enough troops remaining' };

  return { valid: true };
}
