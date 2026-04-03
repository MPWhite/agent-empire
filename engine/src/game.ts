import type { GameState, Player, GamePhase, TechProgress, Territory } from './types.js';
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

/**
 * Sum of a territory's per-turn resource production.
 */
function territoryValue(t: Territory): number {
  const r = t.resources;
  return (r.oil ?? 0) + (r.minerals ?? 0) + (r.food ?? 0) + (r.money ?? 0);
}

/**
 * Returns true if removing `territoryId` from `playerId`'s territories
 * leaves all remaining territories connected via adjacency.
 */
function isRemovalSafe(
  state: GameState,
  playerId: string,
  territoryId: string,
): boolean {
  const adj = state.map.adjacency;
  const owned: string[] = [];
  for (const [id, t] of state.map.territories) {
    if (t.ownerId === playerId && id !== territoryId) owned.push(id);
  }
  if (owned.length === 0) return false;

  const visited = new Set<string>();
  const queue = [owned[0]];
  visited.add(owned[0]);
  while (queue.length > 0) {
    const curr = queue.pop()!;
    for (const n of adj.get(curr) ?? []) {
      if (!visited.has(n) && n !== territoryId) {
        const nt = state.map.territories.get(n);
        if (nt?.ownerId === playerId) {
          visited.add(n);
          queue.push(n);
        }
      }
    }
  }
  return visited.size === owned.length;
}

/**
 * Compute total resource value for each player.
 */
function computePlayerValues(state: GameState): Map<string, number> {
  const values = new Map<string, number>();
  for (const pid of state.players.keys()) values.set(pid, 0);
  for (const t of state.map.territories.values()) {
    if (t.ownerId && values.has(t.ownerId)) {
      values.set(t.ownerId, values.get(t.ownerId)! + territoryValue(t));
    }
  }
  return values;
}

const BALANCE_MAX_ITERATIONS = 200;
const BALANCE_THRESHOLD = 4;

/**
 * Iteratively transfer border territories between players to equalize resource
 * production. Uses variance reduction (sum of squared deviations from target)
 * as the metric — every move toward the mean counts, enabling chain transfers
 * through intermediate players. Stops when the max-min gap is within threshold.
 */
function balanceBySwaps(state: GameState): void {
  const adj = state.map.adjacency;

  let totalValue = 0;
  for (const t of state.map.territories.values()) totalValue += territoryValue(t);
  const target = totalValue / state.players.size;

  for (let iter = 0; iter < BALANCE_MAX_ITERATIONS; iter++) {
    const values = computePlayerValues(state);
    let maxVal = -Infinity;
    let minVal = Infinity;
    for (const v of values.values()) {
      if (v > maxVal) maxVal = v;
      if (v < minVal) minVal = v;
    }
    if (maxVal - minVal <= BALANCE_THRESHOLD) break;

    let bestReduction = 0;
    let bestTid = '';
    let bestRecipient = '';

    for (const [tid, t] of state.map.territories) {
      if (!t.ownerId) continue;
      const donor = t.ownerId;
      const donorVal = values.get(donor)!;
      const tv = territoryValue(t);

      const neighborOwners = new Set<string>();
      for (const nid of adj.get(tid) ?? []) {
        const nt = state.map.territories.get(nid);
        if (nt?.ownerId && nt.ownerId !== donor) neighborOwners.add(nt.ownerId);
      }
      if (neighborOwners.size === 0) continue;

      let safeChecked = false;
      let safe = false;

      for (const recipient of neighborOwners) {
        const recipientVal = values.get(recipient)!;

        // Compute variance reduction — no directional guard, let the
        // metric decide. This enables chain transfers through intermediaries.
        const oldD = (donorVal - target) ** 2 + (recipientVal - target) ** 2;
        const newD = (donorVal - tv - target) ** 2 + (recipientVal + tv - target) ** 2;
        const reduction = oldD - newD;
        if (reduction <= bestReduction) continue;

        if (!safeChecked) { safe = isRemovalSafe(state, donor, tid); safeChecked = true; }
        if (!safe) break;

        bestReduction = reduction;
        bestTid = tid;
        bestRecipient = recipient;
      }
    }

    if (!bestTid) break;
    state.map.territories.get(bestTid)!.ownerId = bestRecipient;
  }
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
// Number of BFS attempts to try — picks the most balanced result
const ASSIGN_ATTEMPTS = 5;

/**
 * Run one BFS flood-fill + swap balancing attempt with the given seed.
 * Modifies territory ownership in-place and returns the max-min resource gap.
 */
function runAssignment(state: GameState, bfsSeed: number): number {
  const playerIds = Array.from(state.players.keys());
  const territoryIds = Array.from(state.map.territories.keys());
  const adjacency = state.map.adjacency;
  let s = bfsSeed;

  const seeds = pickSpreadSeeds(territoryIds, adjacency, playerIds.length, bfsSeed);

  const claimed = new Set<string>();
  const frontiers: string[][] = [];

  for (let i = 0; i < playerIds.length; i++) {
    const seedId = seeds[i];
    const territory = state.map.territories.get(seedId)!;
    territory.ownerId = playerIds[i];
    territory.troops = 3;
    claimed.add(seedId);
    frontiers.push([]);
  }

  for (let i = 0; i < playerIds.length; i++) {
    for (const neighbor of adjacency.get(seeds[i]) ?? []) {
      if (!claimed.has(neighbor)) {
        frontiers[i].push(neighbor);
      }
    }
  }

  // Track running resource value per player for resource-aware picking
  const playerValues = new Array(playerIds.length).fill(0);
  for (let i = 0; i < playerIds.length; i++) {
    playerValues[i] = territoryValue(state.map.territories.get(seeds[i])!);
  }

  let remaining = territoryIds.length - playerIds.length;
  let round = 0;
  while (remaining > 0) {
    let anyExpanded = false;
    const avgValue = playerValues.reduce((a, b) => a + b, 0) / playerIds.length;

    for (let j = 0; j < playerIds.length && remaining > 0; j++) {
      const i = (j + round) % playerIds.length;

      frontiers[i] = frontiers[i].filter((fId) => !claimed.has(fId));
      if (frontiers[i].length === 0) continue;

      // Gentle resource-aware pick: weighted random favoring higher value
      // when behind average, lower value when ahead
      const deficit = avgValue - playerValues[i];
      let pickIdx: number;
      [s, ] = seededRandom(s, frontiers[i].length);
      if (frontiers[i].length <= 2 || Math.abs(deficit) < 2) {
        pickIdx = Math.abs(s) % frontiers[i].length;
      } else {
        const weights: number[] = [];
        let totalWeight = 0;
        for (const fId of frontiers[i]) {
          const tv = territoryValue(state.map.territories.get(fId)!);
          const bonus = deficit > 0 ? tv * 0.5 : (10 - tv) * 0.5;
          const w = 1 + Math.max(0, bonus);
          weights.push(w);
          totalWeight += w;
        }
        let roll = (Math.abs(s) % 1000) / 1000 * totalWeight;
        pickIdx = 0;
        for (let k = 0; k < weights.length; k++) {
          roll -= weights[k];
          if (roll <= 0) { pickIdx = k; break; }
        }
      }
      const pick = frontiers[i][pickIdx];

      const territory = state.map.territories.get(pick)!;
      territory.ownerId = playerIds[i];
      territory.troops = 3;
      playerValues[i] += territoryValue(territory);
      claimed.add(pick);
      frontiers[i].splice(pickIdx, 1);
      remaining--;
      anyExpanded = true;

      for (const neighbor of adjacency.get(pick) ?? []) {
        if (!claimed.has(neighbor) && !frontiers[i].includes(neighbor)) {
          frontiers[i].push(neighbor);
        }
      }
    }

    round++;
    if (!anyExpanded) break;
  }

  balanceBySwaps(state);

  // Return the max-min gap
  const values = computePlayerValues(state);
  let maxVal = -Infinity;
  let minVal = Infinity;
  for (const v of values.values()) {
    if (v > maxVal) maxVal = v;
    if (v < minVal) minVal = v;
  }
  return maxVal - minVal;
}

/**
 * Assign territories using balanced BFS flood-fill with resource-aware picking
 * and post-hoc swap balancing. Tries multiple seeds and keeps the most balanced.
 * Each territory gets 3 starting troops.
 */
export function assignTerritories(
  state: GameState,
  seed?: number,
): GameState {
  const effectiveSeed = seed ?? Date.now();

  // Save initial territory state to restore between attempts
  const initialOwners = new Map<string, string | null>();
  for (const [id, t] of state.map.territories) {
    initialOwners.set(id, t.ownerId);
  }

  let bestGap = Infinity;
  let bestOwners = new Map<string, string | null>();

  for (let attempt = 0; attempt < ASSIGN_ATTEMPTS; attempt++) {
    // Reset territory ownership
    for (const [id, t] of state.map.territories) {
      t.ownerId = initialOwners.get(id)!;
      t.troops = 0;
    }

    // Derive a different seed for each attempt
    const [attemptSeed] = seededRandom(effectiveSeed + attempt * 7919, 0x7fffffff);
    const gap = runAssignment(state, attempt === 0 ? effectiveSeed : attemptSeed);

    if (gap < bestGap) {
      bestGap = gap;
      bestOwners = new Map();
      for (const [id, t] of state.map.territories) {
        bestOwners.set(id, t.ownerId);
      }
    }

    if (bestGap <= BALANCE_THRESHOLD) break; // Good enough
  }

  // Apply best result
  for (const [id, t] of state.map.territories) {
    t.ownerId = bestOwners.get(id)!;
    if (t.ownerId) t.troops = 3;
  }

  return {
    ...state,
    phase: 'playing' as GamePhase,
  };
}
