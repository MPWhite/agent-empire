import type { GameState, Player, GamePhase } from './types.js';
import { createDefaultMap } from './map.js';

const PLAYER_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#eab308',
  '#a855f7', '#f97316', '#06b6d4', '#ec4899',
  '#84cc16', '#6366f1', '#14b8a6', '#f43f5e',
];

/**
 * Create a new game with the default map and given players.
 */
export function createGame(playerDefs: { id: string; name: string }[]): GameState {
  const map = createDefaultMap();
  const players = new Map<string, Player>();

  for (let i = 0; i < playerDefs.length; i++) {
    const def = playerDefs[i];
    players.set(def.id, {
      id: def.id,
      name: def.name,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      isAlive: true,
    });
  }

  return {
    map,
    players,
    turnNumber: 1,
    phase: 'waiting',
  };
}

/**
 * Distribute territories evenly among players with starting troops.
 * Uses round-robin assignment. Each territory gets 3 starting troops.
 */
export function assignTerritories(
  state: GameState,
  seed: number = 42
): GameState {
  const playerIds = Array.from(state.players.keys());
  const territoryIds = Array.from(state.map.territories.keys());

  // Deterministic shuffle of territory IDs
  const shuffled = [...territoryIds];
  let s = seed;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Round-robin assign
  for (let i = 0; i < shuffled.length; i++) {
    const territory = state.map.territories.get(shuffled[i])!;
    territory.ownerId = playerIds[i % playerIds.length];
    territory.troops = 3;
  }

  return {
    ...state,
    phase: 'playing' as GamePhase,
  };
}
