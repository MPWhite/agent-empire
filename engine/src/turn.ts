import type {
  GameState,
  GameEvent,
  PlayerAction,
  AttackAction,
  ReinforceAction,
  TurnResult,
  Territory,
} from './types.js';
import { DOMINANCE_THRESHOLD, MAX_TURNS } from './types.js';
import { validateAction, validateAttackDuringResolution } from './validation.js';
import { resolveCombat, createBattleEvent } from './combat.js';
import { calculateReinforcements } from './reinforcements.js';
import { getPlayerTerritories } from './map.js';

/**
 * Deep-clone a GameState so we can mutate freely.
 */
function cloneState(state: GameState): GameState {
  const territories = new Map<string, Territory>();
  for (const [id, t] of state.map.territories) {
    territories.set(id, { ...t });
  }

  return {
    map: {
      territories,
      continents: state.map.continents, // immutable reference ok
      adjacency: state.map.adjacency,   // immutable reference ok
    },
    players: new Map(
      Array.from(state.players.entries()).map(([id, p]) => [id, { ...p }])
    ),
    turnNumber: state.turnNumber,
    phase: state.phase,
  };
}

/**
 * Shuffle array in-place using Fisher-Yates with a seeded approach.
 * Uses a simple deterministic shuffle based on turn number for reproducibility.
 */
function shuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    // Simple LCG for deterministic shuffle
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Main turn resolution pipeline:
 * 1. Calculate & apply reinforcements
 * 2. Validate actions, discard invalid
 * 3. Shuffle attacks
 * 4. Resolve attacks sequentially against current state
 * 5. Check win/elimination conditions
 */
export function resolveTurn(
  state: GameState,
  actions: PlayerAction[]
): TurnResult {
  const newState = cloneState(state);
  const events: GameEvent[] = [];

  // Separate action types
  const reinforceActions: ReinforceAction[] = [];
  const attackActions: AttackAction[] = [];

  for (const action of actions) {
    const validation = validateAction(state, action);
    if (!validation.valid) continue; // Discard invalid

    if (action.type === 'reinforce') {
      reinforceActions.push(action);
    } else {
      attackActions.push(action);
    }
  }

  // 1. Calculate reinforcement budgets
  const reinforcementBudgets = new Map<string, number>();
  for (const [playerId, player] of newState.players) {
    if (player.isAlive) {
      reinforcementBudgets.set(playerId, calculateReinforcements(newState, playerId));
    }
  }

  // 2. Apply reinforcements (respecting budget)
  const reinforcementsUsed = new Map<string, number>();
  for (const action of reinforceActions) {
    const budget = reinforcementBudgets.get(action.playerId) ?? 0;
    const used = reinforcementsUsed.get(action.playerId) ?? 0;
    const available = budget - used;

    if (available <= 0) continue;

    const troopsToAdd = Math.min(action.troops, available);
    const territory = newState.map.territories.get(action.territoryId)!;
    territory.troops += troopsToAdd;
    reinforcementsUsed.set(action.playerId, used + troopsToAdd);

    events.push({
      type: 'reinforcement',
      playerId: action.playerId,
      territoryId: action.territoryId,
      troops: troopsToAdd,
    });
  }

  // Distribute any unspent reinforcements evenly across owned territories
  for (const [playerId, budget] of reinforcementBudgets) {
    const used = reinforcementsUsed.get(playerId) ?? 0;
    let remaining = budget - used;
    if (remaining <= 0) continue;

    const ownedTerritories = getPlayerTerritories(newState.map, playerId);
    if (ownedTerritories.length === 0) continue;

    let idx = 0;
    while (remaining > 0) {
      const territory = newState.map.territories.get(ownedTerritories[idx % ownedTerritories.length].id)!;
      territory.troops += 1;
      remaining--;
      idx++;
    }
  }

  // 3. Shuffle attack actions deterministically
  const shuffledAttacks = shuffle(attackActions, newState.turnNumber);

  // 4. Resolve attacks sequentially
  for (const attack of shuffledAttacks) {
    // Re-validate against current state (troops may have changed)
    const validation = validateAttackDuringResolution(newState, attack);
    if (!validation.valid) continue;

    const from = newState.map.territories.get(attack.fromTerritoryId)!;
    const to = newState.map.territories.get(attack.toTerritoryId)!;

    // Cap attack troops to what's available (must leave 1 behind)
    const actualAttackTroops = Math.min(attack.troops, from.troops - 1);
    if (actualAttackTroops < 1) continue;

    const defenderId = to.ownerId!;
    const combat = resolveCombat(actualAttackTroops, to.troops);

    // Create battle event
    events.push(createBattleEvent(
      attack.playerId,
      defenderId,
      attack.fromTerritoryId,
      attack.toTerritoryId,
      actualAttackTroops,
      to.troops,
      combat
    ));

    // Apply combat results
    from.troops -= actualAttackTroops;

    if (combat.conquered) {
      // Attackers move in (surviving attackers)
      const survivingAttackers = actualAttackTroops - combat.attackerLosses;
      to.ownerId = attack.playerId;
      to.troops = survivingAttackers;

      events.push({
        type: 'conquest',
        playerId: attack.playerId,
        territoryId: attack.toTerritoryId,
        troopsMoved: survivingAttackers,
      });

      // Check if defender is eliminated
      const defenderTerritories = getPlayerTerritories(newState.map, defenderId);
      if (defenderTerritories.length === 0) {
        const defender = newState.players.get(defenderId);
        if (defender) {
          defender.isAlive = false;
          events.push({
            type: 'elimination',
            playerId: defenderId,
            eliminatedBy: attack.playerId,
          });
        }
      }
    } else {
      // Both sides take losses, no conquest
      const survivingAttackers = actualAttackTroops - combat.attackerLosses;
      from.troops += survivingAttackers; // Return surviving attackers
      to.troops -= combat.defenderLosses;
      // Ensure minimum 1 troop for defender
      if (to.troops < 1) to.troops = 1;
    }
  }

  // 5. Check win conditions
  const alivePlayers = Array.from(newState.players.values()).filter((p) => p.isAlive);

  // 5a. Elimination victory: last player standing
  if (alivePlayers.length === 1) {
    newState.phase = 'finished';
    events.push({
      type: 'victory',
      playerId: alivePlayers[0].id,
      reason: 'elimination',
    });
  }

  // 5b. Dominance victory: first to DOMINANCE_THRESHOLD territories
  if (newState.phase !== 'finished') {
    for (const player of alivePlayers) {
      const territories = getPlayerTerritories(newState.map, player.id);
      if (territories.length >= DOMINANCE_THRESHOLD) {
        newState.phase = 'finished';
        events.push({
          type: 'victory',
          playerId: player.id,
          reason: 'dominance',
        });
        break;
      }
    }
  }

  // 5c. Timer victory: most territories after MAX_TURNS
  if (newState.phase !== 'finished' && state.turnNumber >= MAX_TURNS) {
    let bestPlayer = alivePlayers[0];
    let bestCount = 0;
    for (const player of alivePlayers) {
      const count = getPlayerTerritories(newState.map, player.id).length;
      if (count > bestCount) {
        bestCount = count;
        bestPlayer = player;
      }
    }
    newState.phase = 'finished';
    events.push({
      type: 'victory',
      playerId: bestPlayer.id,
      reason: 'timer',
    });
  }

  newState.turnNumber = state.turnNumber + 1;

  return { state: newState, events };
}
