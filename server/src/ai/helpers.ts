import type { GameState, Territory } from 'engine';
import { getPlayerTerritories, getNeighbors } from 'engine';

/**
 * Returns territories owned by playerId that border at least one enemy territory.
 */
export function getBorderTerritories(state: GameState, playerId: string): Territory[] {
  const owned = getPlayerTerritories(state.map, playerId);
  return owned.filter((territory) => {
    const neighborIds = getNeighbors(state.map, territory.id);
    return neighborIds.some((nId) => {
      const neighbor = state.map.territories.get(nId);
      return neighbor && neighbor.ownerId !== null && neighbor.ownerId !== playerId;
    });
  });
}

/**
 * Scores how threatened a territory is.
 * Positive = more enemy troops nearby than friendly troops on this tile.
 */
export function scoreThreat(state: GameState, territory: Territory): number {
  const neighborIds = getNeighbors(state.map, territory.id);
  let enemyTroops = 0;
  for (const nId of neighborIds) {
    const neighbor = state.map.territories.get(nId);
    if (neighbor && neighbor.ownerId !== null && neighbor.ownerId !== territory.ownerId) {
      enemyTroops += neighbor.troops;
    }
  }
  return enemyTroops - territory.troops;
}

/**
 * For each continent, returns how many territories the player owns vs total,
 * plus the continent's bonus troops.
 */
export function getContinentProgress(
  state: GameState,
  playerId: string,
): Map<string, { owned: number; total: number; bonus: number }> {
  const result = new Map<string, { owned: number; total: number; bonus: number }>();

  for (const [continentId, continent] of state.map.continents) {
    let owned = 0;
    for (const tId of continent.territoryIds) {
      const territory = state.map.territories.get(tId);
      if (territory && territory.ownerId === playerId) {
        owned++;
      }
    }
    result.set(continentId, {
      owned,
      total: continent.territoryIds.length,
      bonus: continent.bonusTroops,
    });
  }

  return result;
}
