import { describe, it, expect } from 'vitest';
import { createGame, assignTerritories } from '../game.js';
import { getPlayerTerritories } from '../map.js';
import type { GameState } from '../types.js';

function totalResourceValue(state: GameState, playerId: string): number {
  return getPlayerTerritories(state.map, playerId).reduce((sum, t) => {
    const r = t.resources;
    return sum + (r.oil ?? 0) + (r.minerals ?? 0) + (r.food ?? 0) + (r.money ?? 0);
  }, 0);
}

function isContiguous(state: GameState, playerId: string): boolean {
  const territories = getPlayerTerritories(state.map, playerId);
  if (territories.length === 0) return true;
  const ids = new Set(territories.map((t) => t.id));
  const visited = new Set<string>();
  const queue = [territories[0].id];
  visited.add(territories[0].id);
  while (queue.length > 0) {
    const curr = queue.pop()!;
    for (const n of state.map.adjacency.get(curr) ?? []) {
      if (ids.has(n) && !visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }
  return visited.size === ids.size;
}

describe('balanced starting split', () => {
  it('resource gap is within threshold for 8 players', () => {
    const state = createGame(
      Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` })),
    );
    const result = assignTerritories(state, 91);

    const values = Array.from({ length: 8 }, (_, i) => totalResourceValue(result, `p${i + 1}`));
    const gap = Math.max(...values) - Math.min(...values);
    expect(gap).toBeLessThanOrEqual(8);
  });

  it('resource gap is within threshold for 4 players', () => {
    const state = createGame(
      Array.from({ length: 4 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` })),
    );
    const result = assignTerritories(state, 42);

    const values = Array.from({ length: 4 }, (_, i) => totalResourceValue(result, `p${i + 1}`));
    const gap = Math.max(...values) - Math.min(...values);
    expect(gap).toBeLessThanOrEqual(8);
  });

  it('all players have contiguous territories', () => {
    const state = createGame(
      Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` })),
    );
    const result = assignTerritories(state, 91);

    for (let i = 1; i <= 8; i++) {
      expect(isContiguous(result, `p${i}`)).toBe(true);
    }
  });

  it('works with different seeds', () => {
    for (const seed of [1, 42, 91, 999, 123456]) {
      const state = createGame(
        Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, name: `Player ${i + 1}` })),
      );
      const result = assignTerritories(state, seed);

      const values = Array.from({ length: 8 }, (_, i) => totalResourceValue(result, `p${i + 1}`));
      const gap = Math.max(...values) - Math.min(...values);
      expect(gap).toBeLessThanOrEqual(8);

      for (let i = 1; i <= 8; i++) {
        expect(isContiguous(result, `p${i}`)).toBe(true);
      }
    }
  });
});
