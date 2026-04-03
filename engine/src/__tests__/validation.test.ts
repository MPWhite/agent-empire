import { describe, it, expect } from 'vitest';
import { validateAction } from '../validation.js';
import { createGame, assignTerritories } from '../game.js';
import type { AttackAction, ReinforceAction, GameState } from '../types.js';
import { areAdjacent, getPlayerTerritories } from '../map.js';

function setupGame(): GameState {
  const state = createGame([
    { id: 'p1', name: 'Player 1' },
    { id: 'p2', name: 'Player 2' },
    { id: 'p3', name: 'Player 3' },
    { id: 'p4', name: 'Player 4' },
    { id: 'p5', name: 'Player 5' },
    { id: 'p6', name: 'Player 6' },
    { id: 'p7', name: 'Player 7' },
    { id: 'p8', name: 'Player 8' },
  ]);
  return assignTerritories(state, 91);
}

describe('validateAction', () => {
  describe('attack validation', () => {
    it('rejects attack on non-adjacent territory', () => {
      const state = setupGame();
      // Find two non-adjacent territories owned by different players
      const p1Territories = getPlayerTerritories(state.map, 'p1');
      const p2Territories = getPlayerTerritories(state.map, 'p2');

      // Find a p1 territory not adjacent to any p2 territory
      let fromId = '';
      let toId = '';
      outer: for (const t1 of p1Territories) {
        for (const t2 of p2Territories) {
          if (!areAdjacent(state.map, t1.id, t2.id)) {
            fromId = t1.id;
            toId = t2.id;
            break outer;
          }
        }
      }

      if (fromId && toId) {
        const action: AttackAction = {
          type: 'attack',
          playerId: 'p1',
          fromTerritoryId: fromId,
          toTerritoryId: toId,
          troops: 1,
        };
        const result = validateAction(state, action);
        expect(result.valid).toBe(false);
        expect(result.valid).toBe(false);
      }
    });

    it('rejects attack with insufficient troops', () => {
      const state = setupGame();
      const p1Territories = getPlayerTerritories(state.map, 'p1');
      const p2Territories = getPlayerTerritories(state.map, 'p2');

      // Find adjacent territories
      let fromId = '';
      let toId = '';
      outer: for (const t1 of p1Territories) {
        for (const t2 of p2Territories) {
          if (areAdjacent(state.map, t1.id, t2.id)) {
            fromId = t1.id;
            toId = t2.id;
            break outer;
          }
        }
      }

      if (fromId && toId) {
        // Each territory has 3 troops; attacking with 3 would leave 0
        const action: AttackAction = {
          type: 'attack',
          playerId: 'p1',
          fromTerritoryId: fromId,
          toTerritoryId: toId,
          troops: 3, // same as total troops — must leave 1 behind
        };
        const result = validateAction(state, action);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('at least 1 troop behind');
      }
    });

    it('rejects attack on own territory', () => {
      const state = setupGame();
      const p1Territories = getPlayerTerritories(state.map, 'p1');

      // Find two adjacent p1 territories
      let fromId = '';
      let toId = '';
      outer: for (const t1 of p1Territories) {
        for (const t2 of p1Territories) {
          if (t1.id !== t2.id && areAdjacent(state.map, t1.id, t2.id)) {
            fromId = t1.id;
            toId = t2.id;
            break outer;
          }
        }
      }

      if (fromId && toId) {
        const action: AttackAction = {
          type: 'attack',
          playerId: 'p1',
          fromTerritoryId: fromId,
          toTerritoryId: toId,
          troops: 1,
        };
        const result = validateAction(state, action);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('own territory');
      }
    });

    it('rejects attack from territory not owned by player', () => {
      const state = setupGame();
      const p2Territories = getPlayerTerritories(state.map, 'p2');
      const p1Territories = getPlayerTerritories(state.map, 'p1');

      let fromId = '';
      let toId = '';
      outer: for (const t2 of p2Territories) {
        for (const t1 of p1Territories) {
          if (areAdjacent(state.map, t2.id, t1.id)) {
            fromId = t2.id; // p2's territory
            toId = t1.id;
            break outer;
          }
        }
      }

      if (fromId && toId) {
        const action: AttackAction = {
          type: 'attack',
          playerId: 'p1', // p1 tries to attack FROM p2's territory
          fromTerritoryId: fromId,
          toTerritoryId: toId,
          troops: 1,
        };
        const result = validateAction(state, action);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('does not own');
      }
    });

    it('accepts valid attack', () => {
      const state = setupGame();
      const p1Territories = getPlayerTerritories(state.map, 'p1');
      const p2Territories = getPlayerTerritories(state.map, 'p2');

      let fromId = '';
      let toId = '';
      outer: for (const t1 of p1Territories) {
        for (const t2 of p2Territories) {
          if (areAdjacent(state.map, t1.id, t2.id)) {
            fromId = t1.id;
            toId = t2.id;
            break outer;
          }
        }
      }

      if (fromId && toId) {
        const action: AttackAction = {
          type: 'attack',
          playerId: 'p1',
          fromTerritoryId: fromId,
          toTerritoryId: toId,
          troops: 2,
        };
        const result = validateAction(state, action);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('reinforce validation', () => {
    it('accepts valid reinforcement', () => {
      const state = setupGame();
      const p1Territories = getPlayerTerritories(state.map, 'p1');
      const action: ReinforceAction = {
        type: 'reinforce',
        playerId: 'p1',
        territoryId: p1Territories[0].id,
        troops: 2,
      };
      const result = validateAction(state, action);
      expect(result.valid).toBe(true);
    });

    it('rejects reinforcement on enemy territory', () => {
      const state = setupGame();
      const p2Territories = getPlayerTerritories(state.map, 'p2');
      const action: ReinforceAction = {
        type: 'reinforce',
        playerId: 'p1',
        territoryId: p2Territories[0].id,
        troops: 2,
      };
      const result = validateAction(state, action);
      expect(result.valid).toBe(false);
    });
  });
});
