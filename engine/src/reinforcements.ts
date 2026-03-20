import type { GameState } from './types.js';
import { getPlayerTerritories, playerOwnsContinent } from './map.js';

/**
 * Calculate reinforcements for a player:
 * - territories / 3 (floored)
 * - + continent bonuses for fully owned continents
 * - minimum 3
 */
export function calculateReinforcements(state: GameState, playerId: string): number {
  const territories = getPlayerTerritories(state.map, playerId);
  const territoryCount = territories.length;

  if (territoryCount === 0) return 0;

  let reinforcements = Math.floor(territoryCount / 3);

  // Continent bonuses
  for (const [continentId, continent] of state.map.continents) {
    if (playerOwnsContinent(state.map, playerId, continentId)) {
      reinforcements += continent.bonusTroops;
    }
  }

  return Math.max(reinforcements, 3);
}
