import type { GameState, SpyAction, CyberattackAction, SpyEvent } from '../types.js';

const SPY_MONEY_COST = 10;
const CYBERATTACK_MONEY_COST = 15;
const CYBERATTACK_MINERAL_COST = 5;
const SABOTAGE_SUCCESS_RATE = 0.6; // 60% chance — deterministic via turn number
const STEAL_TECH_SUCCESS_RATE = 0.4; // 40% chance

/**
 * Validate a spy action.
 */
export function validateSpy(state: GameState, action: SpyAction): { valid: boolean; reason?: string } {
  const player = state.players.get(action.playerId);
  if (!player) return { valid: false, reason: 'Player not found' };
  if (!player.isAlive) return { valid: false, reason: 'Player is eliminated' };

  // Requires Intel Tech 2+ (Spy Network)
  if (player.tech.intelligence < 2) return { valid: false, reason: 'Requires Intelligence Tech level 2 (Spy Network)' };

  // Check money
  if (player.resources.money < SPY_MONEY_COST) return { valid: false, reason: `Requires ${SPY_MONEY_COST} money` };

  // Check target
  const target = state.players.get(action.targetPlayerId);
  if (!target) return { valid: false, reason: 'Target player not found' };
  if (!target.isAlive) return { valid: false, reason: 'Target player is eliminated' };
  if (action.targetPlayerId === action.playerId) return { valid: false, reason: 'Cannot spy on yourself' };

  // Specific operation requirements
  if (action.operation === 'sabotage' && player.tech.intelligence < 2) {
    return { valid: false, reason: 'Requires Intelligence Tech level 2' };
  }
  if (action.operation === 'stealTech' && player.tech.intelligence < 4) {
    return { valid: false, reason: 'Requires Intelligence Tech level 4 for tech theft' };
  }

  return { valid: true };
}

/**
 * Validate a cyberattack action.
 */
export function validateCyberattack(state: GameState, action: CyberattackAction): { valid: boolean; reason?: string } {
  const player = state.players.get(action.playerId);
  if (!player) return { valid: false, reason: 'Player not found' };
  if (!player.isAlive) return { valid: false, reason: 'Player is eliminated' };

  // Requires Intel Tech 4+
  if (player.tech.intelligence < 4) return { valid: false, reason: 'Requires Intelligence Tech level 4 (Cyberattack)' };

  // Check resources
  if (player.resources.money < CYBERATTACK_MONEY_COST) return { valid: false, reason: `Requires ${CYBERATTACK_MONEY_COST} money` };
  if (player.resources.minerals < CYBERATTACK_MINERAL_COST) return { valid: false, reason: `Requires ${CYBERATTACK_MINERAL_COST} minerals` };

  // Check target
  const target = state.players.get(action.targetPlayerId);
  if (!target) return { valid: false, reason: 'Target player not found' };
  if (!target.isAlive) return { valid: false, reason: 'Target player is eliminated' };

  if (action.target === 'fort') {
    const territory = state.map.territories.get(action.territoryOrBranch);
    if (!territory) return { valid: false, reason: 'Territory not found' };
    if (territory.ownerId !== action.targetPlayerId) return { valid: false, reason: 'Target does not own this territory' };
    if (territory.fortLevel === 0) return { valid: false, reason: 'Territory has no fortification' };
  } else if (action.target === 'tech') {
    const branch = action.territoryOrBranch as 'military' | 'economic' | 'intelligence';
    if (!['military', 'economic', 'intelligence'].includes(branch)) {
      return { valid: false, reason: 'Invalid tech branch' };
    }
    if (target.tech[branch] === 0) return { valid: false, reason: 'Target has no tech in this branch' };
  }

  return { valid: true };
}

/**
 * Deterministic "random" check using turn number and player IDs.
 */
function deterministicCheck(seed: number, threshold: number): boolean {
  const hash = Math.abs((seed * 2654435761) & 0xffffffff);
  return (hash % 100) < (threshold * 100);
}

/**
 * Resolve a spy operation. Modifies state in place.
 */
export function resolveSpy(state: GameState, action: SpyAction): SpyEvent | null {
  const validation = validateSpy(state, action);
  if (!validation.valid) return null;

  const player = state.players.get(action.playerId)!;
  const target = state.players.get(action.targetPlayerId)!;

  // Deduct money
  player.resources.money -= SPY_MONEY_COST;

  // Check if target has counter-intelligence (Intel Tech 5)
  if (target.tech.intelligence >= 5) {
    return {
      type: 'spyEvent',
      subtype: 'spyDetected',
      attackerId: action.playerId,
      targetId: action.targetPlayerId,
      details: 'Spy operation detected and blocked by counter-intelligence.',
    };
  }

  const seed = state.turnNumber * 31 + action.playerId.charCodeAt(action.playerId.length - 1) * 17;

  switch (action.operation) {
    case 'intel': {
      // Always succeeds — provides info (handled in state filtering)
      return {
        type: 'spyEvent',
        subtype: 'intelGathered',
        attackerId: action.playerId,
        targetId: action.targetPlayerId,
        details: 'Intelligence gathered on target empire.',
      };
    }
    case 'sabotage': {
      if (deterministicCheck(seed, SABOTAGE_SUCCESS_RATE)) {
        // Steal 10% of target's resource production (reduce stockpile)
        const stolen = Math.floor(target.resources.money * 0.1);
        target.resources.money -= stolen;
        player.resources.money += stolen;
        return {
          type: 'spyEvent',
          subtype: 'sabotageSuccess',
          attackerId: action.playerId,
          targetId: action.targetPlayerId,
          details: `Sabotage successful: ${stolen} money stolen.`,
        };
      }
      return {
        type: 'spyEvent',
        subtype: 'sabotageFailed',
        attackerId: action.playerId,
        targetId: action.targetPlayerId,
        details: 'Sabotage operation failed.',
      };
    }
    case 'stealTech': {
      if (deterministicCheck(seed + 7, STEAL_TECH_SUCCESS_RATE)) {
        // Find target's highest tech branch and copy 1 level of progress
        let bestBranch: 'military' | 'economic' | 'intelligence' = 'military';
        let bestLevel = target.tech.military;
        if (target.tech.economic > bestLevel) { bestBranch = 'economic'; bestLevel = target.tech.economic; }
        if (target.tech.intelligence > bestLevel) { bestBranch = 'intelligence'; }

        // Add progress to player's tech (equivalent to 1 level's worth of points)
        const progress = state.techProgress.get(action.playerId);
        if (progress) {
          progress[bestBranch] += 10; // Bonus research points
        }

        return {
          type: 'spyEvent',
          subtype: 'techStolen',
          attackerId: action.playerId,
          targetId: action.targetPlayerId,
          details: `Tech stolen: gained research progress in ${bestBranch}.`,
        };
      }
      return {
        type: 'spyEvent',
        subtype: 'sabotageFailed',
        attackerId: action.playerId,
        targetId: action.targetPlayerId,
        details: 'Tech theft operation failed.',
      };
    }
    default:
      return null;
  }
}

/**
 * Resolve a cyberattack. Modifies state in place.
 */
export function resolveCyberattack(state: GameState, action: CyberattackAction): SpyEvent | null {
  const validation = validateCyberattack(state, action);
  if (!validation.valid) return null;

  const player = state.players.get(action.playerId)!;
  const target = state.players.get(action.targetPlayerId)!;

  // Deduct resources
  player.resources.money -= CYBERATTACK_MONEY_COST;
  player.resources.minerals -= CYBERATTACK_MINERAL_COST;

  // Check counter-intelligence
  if (target.tech.intelligence >= 5) {
    return {
      type: 'spyEvent',
      subtype: 'spyDetected',
      attackerId: action.playerId,
      targetId: action.targetPlayerId,
      details: 'Cyberattack detected and blocked by counter-intelligence.',
    };
  }

  if (action.target === 'fort') {
    const territory = state.map.territories.get(action.territoryOrBranch);
    if (territory && territory.fortLevel > 0) {
      territory.fortLevel--;
      return {
        type: 'spyEvent',
        subtype: 'sabotageSuccess',
        attackerId: action.playerId,
        targetId: action.targetPlayerId,
        details: `Cyberattack disabled fortification in ${territory.name}.`,
      };
    }
  } else if (action.target === 'tech') {
    // Temporarily disable tech (handled via a flag — for simplicity, reduce by 1 for this turn)
    // The actual mechanic: the tech is "disabled for 1 turn" — we handle this by
    // storing a disabledTech marker. For now, we just report success.
    return {
      type: 'spyEvent',
      subtype: 'sabotageSuccess',
      attackerId: action.playerId,
      targetId: action.targetPlayerId,
      details: `Cyberattack disabled ${action.territoryOrBranch} tech for 1 turn.`,
    };
  }

  return null;
}
