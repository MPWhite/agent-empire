import type { GameState, PlayerAction, AttackAction, ReinforceAction } from 'engine';
import { calculateReinforcements, getNeighbors, getPlayerTerritories } from 'engine';
import { getBorderTerritories, scoreThreat, getContinentProgress } from './helpers.js';

/**
 * Generates a full set of actions (reinforcements + attacks) for an AI player.
 */
export function generateAIActions(state: GameState, playerId: string): PlayerAction[] {
  const reinforceActions = planReinforcements(state, playerId);
  const attackActions = planAttacks(state, playerId, reinforceActions);
  return [...reinforceActions, ...attackActions];
}

function planReinforcements(state: GameState, playerId: string): ReinforceAction[] {
  const budget = calculateReinforcements(state, playerId);
  if (budget === 0) return [];

  const borders = getBorderTerritories(state, playerId);
  const continentProgress = getContinentProgress(state, playerId);

  // Build territory → continent lookup
  const territoryContinentMap = new Map<string, string>();
  for (const [continentId, continent] of state.map.continents) {
    for (const tId of continent.territoryIds) {
      territoryContinentMap.set(tId, continentId);
    }
  }

  // Score each border territory
  const scored: { territory: typeof borders[0]; score: number }[] = borders.map((t) => {
    let score = scoreThreat(state, t);

    // Continent completion bonus: +5 if player owns >50% of the continent
    const cId = territoryContinentMap.get(t.id);
    if (cId) {
      const progress = continentProgress.get(cId);
      if (progress && progress.total > 0 && progress.owned / progress.total > 0.5) {
        score += 5;
      }
    }

    return { territory: t, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  const actions: ReinforceAction[] = [];

  if (scored.length === 0) {
    // No borders — distribute evenly across all owned territories
    const allOwned = getPlayerTerritories(state.map, playerId);
    if (allOwned.length === 0) return [];
    const perTerritory = Math.floor(budget / allOwned.length);
    let remainder = budget - perTerritory * allOwned.length;
    for (const t of allOwned) {
      const troops = perTerritory + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      if (troops > 0) {
        actions.push({ type: 'reinforce', playerId, territoryId: t.id, troops });
      }
    }
    return actions;
  }

  // Check if all scores are <= 0
  const allNonPositive = scored.every((s) => s.score <= 0);

  if (allNonPositive) {
    // Distribute evenly across border territories
    const perTerritory = Math.floor(budget / scored.length);
    let remainder = budget - perTerritory * scored.length;
    for (const { territory } of scored) {
      const troops = perTerritory + (remainder > 0 ? 1 : 0);
      if (remainder > 0) remainder--;
      if (troops > 0) {
        actions.push({ type: 'reinforce', playerId, territoryId: territory.id, troops });
      }
    }
    return actions;
  }

  // Weighted distribution proportional to score
  // Shift scores so minimum is 1 to ensure positive weights
  const minScore = Math.min(...scored.map((s) => s.score));
  const shift = minScore < 1 ? 1 - minScore : 0;
  const weights = scored.map((s) => s.score + shift);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  let remaining = budget;
  for (let i = 0; i < scored.length; i++) {
    const troops =
      i === scored.length - 1
        ? remaining // Last one gets whatever is left
        : Math.floor((weights[i] / totalWeight) * budget);
    remaining -= troops;
    if (troops > 0) {
      actions.push({
        type: 'reinforce',
        playerId,
        territoryId: scored[i].territory.id,
        troops,
      });
    }
  }

  return actions;
}

interface AttackCandidate {
  from: string;
  to: string;
  troops: number;
  score: number;
  enemyTroops: number;
}

function planAttacks(
  state: GameState,
  playerId: string,
  reinforcements: ReinforceAction[],
): AttackAction[] {
  const borders = getBorderTerritories(state, playerId);
  const continentProgress = getContinentProgress(state, playerId);

  // Build territory → continent lookup
  const territoryContinentMap = new Map<string, string>();
  for (const [continentId, continent] of state.map.continents) {
    for (const tId of continent.territoryIds) {
      territoryContinentMap.set(tId, continentId);
    }
  }

  // Build effective troops map (actual + planned reinforcements)
  const effectiveTroops = new Map<string, number>();
  for (const t of borders) {
    effectiveTroops.set(t.id, t.troops);
  }
  for (const r of reinforcements) {
    const current = effectiveTroops.get(r.territoryId) ?? 0;
    effectiveTroops.set(r.territoryId, current + r.troops);
  }

  // Track committed troops per territory
  const committed = new Map<string, number>();

  // Build all attack candidates
  const candidates: AttackCandidate[] = [];

  for (const territory of borders) {
    const neighborIds = getNeighbors(state.map, territory.id);
    for (const nId of neighborIds) {
      const neighbor = state.map.territories.get(nId);
      if (!neighbor || neighbor.ownerId === null || neighbor.ownerId === playerId) continue;

      const effective = effectiveTroops.get(territory.id) ?? territory.troops;
      const alreadyCommitted = committed.get(territory.id) ?? 0;
      const available = effective - alreadyCommitted - 1; // Must leave 1

      if (available < 1) continue;

      const enemyTroops = neighbor.troops;
      const ratio = available / enemyTroops;

      if (ratio < 1.8) continue;

      let score = ratio * enemyTroops;

      // Continent completion bonus
      const cId = territoryContinentMap.get(nId);
      if (cId) {
        const progress = continentProgress.get(cId);
        if (progress && progress.total > 0) {
          // If conquering this territory would give >75% of continent
          const newOwned = progress.owned + 1;
          if (newOwned / progress.total > 0.75) {
            score += 10;
          }
        }
      }

      candidates.push({
        from: territory.id,
        to: nId,
        troops: 0, // Will be calculated when selected
        score,
        enemyTroops,
      });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Greedily pick top candidates (up to 5)
  const actions: AttackAction[] = [];
  for (const candidate of candidates) {
    if (actions.length >= 5) break;

    const effective = effectiveTroops.get(candidate.from) ?? 0;
    const alreadyCommitted = committed.get(candidate.from) ?? 0;
    const available = effective - alreadyCommitted - 1;

    if (available < 1) continue;

    const ratio = available / candidate.enemyTroops;
    if (ratio < 1.8) continue;

    const troops = Math.min(available, Math.ceil(candidate.enemyTroops * 2.5));

    committed.set(candidate.from, alreadyCommitted + troops);

    actions.push({
      type: 'attack',
      playerId,
      fromTerritoryId: candidate.from,
      toTerritoryId: candidate.to,
      troops,
    });
  }

  return actions;
}
