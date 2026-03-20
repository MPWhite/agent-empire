import { describe, it, expect } from 'vitest';
import { resolveTurn } from '../turn.js';
import { createGame, assignTerritories } from '../game.js';
import { calculateReinforcements } from '../reinforcements.js';
import { getPlayerTerritories, areAdjacent } from '../map.js';
import type { AttackAction, ReinforceAction, GameState } from '../types.js';

function setupGame(): GameState {
  const state = createGame([
    { id: 'p1', name: 'Alice' },
    { id: 'p2', name: 'Bob' },
  ]);
  return assignTerritories(state, 42);
}

function findAttackPair(state: GameState, attackerId: string, defenderId: string) {
  const attackerTerritories = getPlayerTerritories(state.map, attackerId);
  const defenderTerritories = getPlayerTerritories(state.map, defenderId);

  for (const t1 of attackerTerritories) {
    for (const t2 of defenderTerritories) {
      if (areAdjacent(state.map, t1.id, t2.id)) {
        return { from: t1.id, to: t2.id };
      }
    }
  }
  throw new Error('No adjacent attack pair found');
}

describe('resolveTurn', () => {
  it('increments turn number', () => {
    const state = setupGame();
    const result = resolveTurn(state, []);
    expect(result.state.turnNumber).toBe(state.turnNumber + 1);
  });

  it('applies reinforcements', () => {
    const state = setupGame();
    const p1Territories = getPlayerTerritories(state.map, 'p1');
    const totalTroopsBefore = p1Territories.reduce((sum, t) => sum + t.troops, 0);
    const expectedReinforcements = calculateReinforcements(state, 'p1');

    const result = resolveTurn(state, []);
    const p1TerritoriesAfter = getPlayerTerritories(result.state.map, 'p1');
    const totalTroopsAfter = p1TerritoriesAfter.reduce((sum, t) => sum + t.troops, 0);

    // Reinforcements are distributed (unspent ones go round-robin)
    expect(totalTroopsAfter).toBe(totalTroopsBefore + expectedReinforcements);
  });

  it('resolves a valid attack', () => {
    const state = setupGame();
    const { from, to } = findAttackPair(state, 'p1', 'p2');

    // Give attacker more troops for a meaningful attack
    state.map.territories.get(from)!.troops = 10;

    const action: AttackAction = {
      type: 'attack',
      playerId: 'p1',
      fromTerritoryId: from,
      toTerritoryId: to,
      troops: 8,
    };

    const result = resolveTurn(state, [action]);
    const battleEvents = result.events.filter((e) => e.type === 'battle');
    expect(battleEvents.length).toBeGreaterThanOrEqual(1);
  });

  it('discards invalid actions', () => {
    const state = setupGame();
    const p2Territories = getPlayerTerritories(state.map, 'p2');

    // P1 tries to attack from p2's territory — invalid
    const action: AttackAction = {
      type: 'attack',
      playerId: 'p1',
      fromTerritoryId: p2Territories[0].id,
      toTerritoryId: p2Territories[0].id,
      troops: 1,
    };

    const result = resolveTurn(state, [action]);
    const battleEvents = result.events.filter((e) => e.type === 'battle');
    expect(battleEvents.length).toBe(0);
  });

  it('applies reinforcement actions respecting budget', () => {
    const state = setupGame();
    const p1Territories = getPlayerTerritories(state.map, 'p1');
    const budget = calculateReinforcements(state, 'p1');

    const action: ReinforceAction = {
      type: 'reinforce',
      playerId: 'p1',
      territoryId: p1Territories[0].id,
      troops: budget,
    };

    const result = resolveTurn(state, [action]);
    const territory = result.state.map.territories.get(p1Territories[0].id)!;

    // The territory should have original troops + reinforcement troops
    expect(territory.troops).toBe(3 + budget);
  });

  it('caps reinforcements at budget even if requesting more', () => {
    const state = setupGame();
    const p1Territories = getPlayerTerritories(state.map, 'p1');
    const budget = calculateReinforcements(state, 'p1');

    const action: ReinforceAction = {
      type: 'reinforce',
      playerId: 'p1',
      territoryId: p1Territories[0].id,
      troops: budget + 100, // Way more than budget
    };

    const result = resolveTurn(state, [action]);
    // Total p1 troops should increase by exactly the budget
    const totalAfter = getPlayerTerritories(result.state.map, 'p1')
      .reduce((sum, t) => sum + t.troops, 0);
    const totalBefore = p1Territories.reduce((sum, t) => sum + t.troops, 0);
    expect(totalAfter).toBe(totalBefore + budget);
  });

  it('sequential attacks — second sees post-first state', () => {
    const state = setupGame();
    const { from, to } = findAttackPair(state, 'p1', 'p2');

    // Give attacker a lot of troops
    state.map.territories.get(from)!.troops = 20;
    // Give defender only 1 troop
    state.map.territories.get(to)!.troops = 1;

    // Two attacks on same target
    const action1: AttackAction = {
      type: 'attack',
      playerId: 'p1',
      fromTerritoryId: from,
      toTerritoryId: to,
      troops: 5,
    };
    const action2: AttackAction = {
      type: 'attack',
      playerId: 'p1',
      fromTerritoryId: from,
      toTerritoryId: to,
      troops: 5,
    };

    const result = resolveTurn(state, [action1, action2]);

    // First attack should conquer (20:1 attacker advantage against 1 defender)
    // Second attack should be invalid (p1 now owns the target)
    const battleEvents = result.events.filter((e) => e.type === 'battle');
    // Only 1 battle should happen (second is invalid since p1 already owns it)
    expect(battleEvents.length).toBe(1);
  });

  it('handles conquest and troop movement', () => {
    const state = setupGame();
    const { from, to } = findAttackPair(state, 'p1', 'p2');

    state.map.territories.get(from)!.troops = 10;
    state.map.territories.get(to)!.troops = 1;

    const action: AttackAction = {
      type: 'attack',
      playerId: 'p1',
      fromTerritoryId: from,
      toTerritoryId: to,
      troops: 8,
    };

    const result = resolveTurn(state, [action]);
    const conquestEvents = result.events.filter((e) => e.type === 'conquest');

    if (conquestEvents.length > 0) {
      const conquered = result.state.map.territories.get(to)!;
      expect(conquered.ownerId).toBe('p1');
      expect(conquered.troops).toBeGreaterThan(0);
    }
  });

  it('detects player elimination', () => {
    const state = setupGame();

    // Give p1 all territories except one, give p2 one territory with 1 troop
    const allTerritories = Array.from(state.map.territories.values());
    for (const t of allTerritories) {
      t.ownerId = 'p1';
      t.troops = 50;
    }
    // Give p2 exactly one territory
    const lastTerritory = allTerritories[allTerritories.length - 1];
    lastTerritory.ownerId = 'p2';
    lastTerritory.troops = 1;

    // Find p1 territory adjacent to p2's last territory
    const neighbors = Array.from(state.map.adjacency.get(lastTerritory.id) ?? []);
    const attackFrom = neighbors[0];

    // p2 gets min 3 reinforcements, so territory goes to ~4 troops
    // Need overwhelming force: 40 vs 4 = 10:1 ratio, conquers easily
    const action: AttackAction = {
      type: 'attack',
      playerId: 'p1',
      fromTerritoryId: attackFrom,
      toTerritoryId: lastTerritory.id,
      troops: 40,
    };

    const result = resolveTurn(state, [action]);
    const eliminationEvents = result.events.filter((e) => e.type === 'elimination');

    // Should conquer and eliminate
    expect(eliminationEvents.length).toBe(1);
    if (eliminationEvents.length > 0) {
      expect(eliminationEvents[0].type === 'elimination' && eliminationEvents[0].playerId).toBe('p2');
    }

    // p2 should be marked not alive
    expect(result.state.players.get('p2')!.isAlive).toBe(false);
  });
});
