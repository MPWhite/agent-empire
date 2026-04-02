import type { GameState, Player } from './types.js';
import { TROOP_MONEY_COST } from './types.js';
import { getPlayerTerritories, playerOwnsContinent } from './map.js';

/**
 * Calculate the reinforcement budget for a player (number of troops available).
 * Same formula as classic Risk:
 * - territories / 3 (floored)
 * - + continent bonuses for fully owned continents
 * - minimum 3
 *
 * The player must also be able to afford them (1 money per troop).
 * Returns the number of troops the player can actually recruit.
 */
export function calculateReinforcements(state: GameState, playerId: string): number {
  const player = state.players.get(playerId);
  if (!player) return 0;

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

  reinforcements = Math.max(reinforcements, 3);

  // Cap by money available
  const affordable = Math.floor(player.resources.money / TROOP_MONEY_COST);
  return Math.min(reinforcements, affordable);
}

/**
 * Calculate the maximum theoretical reinforcement count (ignoring money).
 * Useful for display purposes.
 */
export function calculateMaxReinforcements(state: GameState, playerId: string): number {
  const territories = getPlayerTerritories(state.map, playerId);
  const territoryCount = territories.length;

  if (territoryCount === 0) return 0;

  let reinforcements = Math.floor(territoryCount / 3);

  for (const [continentId, continent] of state.map.continents) {
    if (playerOwnsContinent(state.map, playerId, continentId)) {
      reinforcements += continent.bonusTroops;
    }
  }

  return Math.max(reinforcements, 3);
}

/**
 * Deduct money for recruited troops.
 */
export function deductReinforcementCost(player: Player, troops: number): void {
  player.resources.money -= troops * TROOP_MONEY_COST;
}
