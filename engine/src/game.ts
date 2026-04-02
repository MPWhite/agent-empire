import type { GameState, Player, GamePhase, TechProgress } from './types.js';
import { EMPTY_RESOURCES, REPUTATION_INITIAL, EVENT_MIN_INTERVAL } from './types.js';
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
  const techProgress = new Map<string, TechProgress>();

  for (let i = 0; i < playerDefs.length; i++) {
    const def = playerDefs[i];
    players.set(def.id, {
      id: def.id,
      name: def.name,
      color: PLAYER_COLORS[i % PLAYER_COLORS.length],
      isAlive: true,
      resources: { ...EMPTY_RESOURCES, money: 10, food: 10 }, // Starting resources
      tech: { military: 0, economic: 0, intelligence: 0 },
      reputation: REPUTATION_INITIAL,
      shortages: { oil: 0, minerals: 0, food: 0 },
    });
    techProgress.set(def.id, { military: 0, economic: 0, intelligence: 0 });
  }

  return {
    map,
    players,
    turnNumber: 1,
    phase: 'waiting',
    techProgress,
    agreements: [],
    sanctions: [],
    diplomaticMessages: [],
    unResolutions: [],
    activeResolutions: [],
    events: [],
    nextEventTurn: EVENT_MIN_INTERVAL + 1, // First event around turn 9-13
  };
}

// Fixed seed for deterministic territory assignment
const SEED = 91;

/**
 * Seeded LCG — returns [nextSeed, value in [0, max)].
 */
function seededRandom(seed: number, max: number): [number, number] {
  const next = (seed * 1664525 + 1013904223) & 0xffffffff;
  return [next, Math.abs(next) % max];
}

// Minimum neighbor count for a territory to be eligible as a seed.
// Prevents seeds on peninsulas/islands (like New Zealand, Greenland) that get boxed in.
const MIN_SEED_NEIGHBORS = 3;

/**
 * Pick N seed territories maximally spread apart using farthest-first traversal.
 * Only territories with at least MIN_SEED_NEIGHBORS neighbors are eligible as seeds,
 * preventing dead-end placements on peninsulas or islands.
 */
function pickSpreadSeeds(
  territoryIds: string[],
  adjacency: Map<string, Set<string>>,
  count: number,
  seed: number,
): string[] {
  const eligible = territoryIds.filter(
    (id) => (adjacency.get(id)?.size ?? 0) >= MIN_SEED_NEIGHBORS,
  );

  let s = seed;
  let idx: number;
  [s, idx] = seededRandom(s, eligible.length);
  const seeds: string[] = [eligible[idx]];

  for (let i = 1; i < count; i++) {
    // BFS from all existing seeds simultaneously
    const dist = new Map<string, number>();
    const queue: string[] = [];
    for (const src of seeds) {
      dist.set(src, 0);
      queue.push(src);
    }
    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];
      const d = dist.get(curr)!;
      for (const neighbor of adjacency.get(curr) ?? []) {
        if (!dist.has(neighbor)) {
          dist.set(neighbor, d + 1);
          queue.push(neighbor);
        }
      }
    }
    // Pick eligible territory farthest from any existing seed
    let bestId = eligible[0];
    let bestDist = -1;
    for (const id of eligible) {
      const d = dist.get(id) ?? 0;
      if (d > bestDist) {
        bestDist = d;
        bestId = id;
      }
    }
    seeds.push(bestId);
  }

  return seeds;
}

/**
 * Assign territories using balanced BFS flood-fill. Each player expands from
 * their seed one ring at a time. Players take turns claiming ONE territory per
 * round from their frontier, but the round order rotates each cycle so no
 * player has a persistent first-mover advantage.
 * Produces contiguous, balanced regions that cross continent boundaries.
 * Each territory gets 3 starting troops.
 */
export function assignTerritories(
  state: GameState,
): GameState {
  const playerIds = Array.from(state.players.keys());
  const territoryIds = Array.from(state.map.territories.keys());
  const adjacency = state.map.adjacency;
  let s = SEED;

  const seeds = pickSpreadSeeds(territoryIds, adjacency, playerIds.length, SEED);

  // Assign seeds and initialize frontiers
  const claimed = new Set<string>();
  const frontiers: string[][] = []; // ordered lists for deterministic picking

  for (let i = 0; i < playerIds.length; i++) {
    const seedId = seeds[i];
    const territory = state.map.territories.get(seedId)!;
    territory.ownerId = playerIds[i];
    territory.troops = 3;
    claimed.add(seedId);
    frontiers.push([]);
  }

  // Build initial frontiers
  for (let i = 0; i < playerIds.length; i++) {
    for (const neighbor of adjacency.get(seeds[i]) ?? []) {
      if (!claimed.has(neighbor)) {
        frontiers[i].push(neighbor);
      }
    }
  }

  // Balanced round-robin: each player claims 1 territory per round.
  // Starting player rotates each round to prevent first-mover bias.
  let remaining = territoryIds.length - playerIds.length;
  let round = 0;
  while (remaining > 0) {
    let anyExpanded = false;

    for (let j = 0; j < playerIds.length && remaining > 0; j++) {
      const i = (j + round) % playerIds.length;

      // Rebuild frontier: unclaimed neighbors of all owned territories
      // (cheaper to filter than maintain incrementally)
      frontiers[i] = frontiers[i].filter((fId) => !claimed.has(fId));

      if (frontiers[i].length === 0) continue;

      // Pick deterministically using seeded random for organic borders
      [s, ] = seededRandom(s, frontiers[i].length);
      const pickIdx = Math.abs(s) % frontiers[i].length;
      const pick = frontiers[i][pickIdx];

      const territory = state.map.territories.get(pick)!;
      territory.ownerId = playerIds[i];
      territory.troops = 3;
      claimed.add(pick);
      frontiers[i].splice(pickIdx, 1);
      remaining--;
      anyExpanded = true;

      // Add new unclaimed neighbors
      for (const neighbor of adjacency.get(pick) ?? []) {
        if (!claimed.has(neighbor) && !frontiers[i].includes(neighbor)) {
          frontiers[i].push(neighbor);
        }
      }
    }

    round++;
    if (!anyExpanded) break;
  }

  return {
    ...state,
    phase: 'playing' as GamePhase,
  };
}
