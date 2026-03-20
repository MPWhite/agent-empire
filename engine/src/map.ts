import type { GameMap, Territory, Continent } from './types.js';

// ── Raw Map Data ──

interface TerritoryDef {
  id: string;
  name: string;
  continentId: string;
}

interface ContinentDef {
  id: string;
  name: string;
  bonusTroops: number;
}

const CONTINENTS: ContinentDef[] = [
  { id: 'northlands', name: 'Northlands', bonusTroops: 5 },
  { id: 'midlands', name: 'Midlands', bonusTroops: 7 },
  { id: 'desert', name: 'Desert Wastes', bonusTroops: 3 },
  { id: 'islands', name: 'Iron Islands', bonusTroops: 2 },
  { id: 'southlands', name: 'Southlands', bonusTroops: 6 },
];

const TERRITORIES: TerritoryDef[] = [
  // Northlands (6)
  { id: 'n1', name: 'Frostheim', continentId: 'northlands' },
  { id: 'n2', name: 'Glacial Pass', continentId: 'northlands' },
  { id: 'n3', name: 'Ironpeak', continentId: 'northlands' },
  { id: 'n4', name: 'Snowdrift', continentId: 'northlands' },
  { id: 'n5', name: 'Tundra Reach', continentId: 'northlands' },
  { id: 'n6', name: 'Wolfden', continentId: 'northlands' },

  // Midlands (8)
  { id: 'm1', name: 'Kingsfield', continentId: 'midlands' },
  { id: 'm2', name: 'Bridgewater', continentId: 'midlands' },
  { id: 'm3', name: 'Oakshire', continentId: 'midlands' },
  { id: 'm4', name: 'Stonehall', continentId: 'midlands' },
  { id: 'm5', name: 'Riverbend', continentId: 'midlands' },
  { id: 'm6', name: 'Westmarch', continentId: 'midlands' },
  { id: 'm7', name: 'Eastwatch', continentId: 'midlands' },
  { id: 'm8', name: 'Highcastle', continentId: 'midlands' },

  // Desert Wastes (5)
  { id: 'd1', name: 'Sandspire', continentId: 'desert' },
  { id: 'd2', name: 'Oasis', continentId: 'desert' },
  { id: 'd3', name: 'Dusthaven', continentId: 'desert' },
  { id: 'd4', name: 'Scorchplain', continentId: 'desert' },
  { id: 'd5', name: 'Mirage', continentId: 'desert' },

  // Iron Islands (4)
  { id: 'i1', name: 'Port Anvil', continentId: 'islands' },
  { id: 'i2', name: 'Saltrock', continentId: 'islands' },
  { id: 'i3', name: 'Tidecrest', continentId: 'islands' },
  { id: 'i4', name: 'Stormbreak', continentId: 'islands' },

  // Southlands (7)
  { id: 's1', name: 'Sunvale', continentId: 'southlands' },
  { id: 's2', name: 'Greenpeak', continentId: 'southlands' },
  { id: 's3', name: 'Thornfield', continentId: 'southlands' },
  { id: 's4', name: 'Goldmere', continentId: 'southlands' },
  { id: 's5', name: 'Ashwood', continentId: 'southlands' },
  { id: 's6', name: 'Coppervale', continentId: 'southlands' },
  { id: 's7', name: 'Emerald Bay', continentId: 'southlands' },
];

// Adjacency list — bidirectional edges
const EDGES: [string, string][] = [
  // Northlands internal
  ['n1', 'n2'], ['n1', 'n3'], ['n2', 'n4'], ['n2', 'n3'],
  ['n3', 'n5'], ['n4', 'n5'], ['n4', 'n6'], ['n5', 'n6'],

  // Midlands internal
  ['m1', 'm2'], ['m1', 'm3'], ['m2', 'm4'], ['m2', 'm5'],
  ['m3', 'm5'], ['m3', 'm6'], ['m4', 'm7'], ['m5', 'm7'],
  ['m5', 'm6'], ['m6', 'm8'], ['m7', 'm8'],

  // Desert internal
  ['d1', 'd2'], ['d1', 'd3'], ['d2', 'd3'], ['d2', 'd4'],
  ['d3', 'd5'], ['d4', 'd5'],

  // Islands internal
  ['i1', 'i2'], ['i1', 'i3'], ['i2', 'i4'], ['i3', 'i4'],

  // Southlands internal
  ['s1', 's2'], ['s1', 's3'], ['s2', 's4'], ['s3', 's4'],
  ['s3', 's5'], ['s4', 's6'], ['s5', 's6'], ['s5', 's7'],
  ['s6', 's7'],

  // Cross-continent bridges
  ['n5', 'm1'],  // Northlands → Midlands
  ['n6', 'm3'],  // Northlands → Midlands
  ['m7', 'd1'],  // Midlands → Desert
  ['m8', 'd3'],  // Midlands → Desert
  ['m6', 's1'],  // Midlands → Southlands
  ['d4', 's5'],  // Desert → Southlands
  ['d5', 's7'],  // Desert → Southlands
  ['i1', 'm2'],  // Islands → Midlands
  ['i3', 's2'],  // Islands → Southlands
];

// ── Map Construction ──

export function createDefaultMap(): GameMap {
  const territories = new Map<string, Territory>();
  const continents = new Map<string, Continent>();
  const adjacency = new Map<string, Set<string>>();

  // Build continents
  for (const def of CONTINENTS) {
    const territoryIds = TERRITORIES
      .filter((t) => t.continentId === def.id)
      .map((t) => t.id);
    continents.set(def.id, { ...def, territoryIds });
  }

  // Build territories (unowned, 0 troops)
  for (const def of TERRITORIES) {
    territories.set(def.id, {
      ...def,
      ownerId: null,
      troops: 0,
    });
    adjacency.set(def.id, new Set());
  }

  // Build adjacency graph (bidirectional)
  for (const [a, b] of EDGES) {
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  }

  return { territories, continents, adjacency };
}

// ── Adjacency Helpers ──

export function areAdjacent(map: GameMap, a: string, b: string): boolean {
  return map.adjacency.get(a)?.has(b) ?? false;
}

export function getNeighbors(map: GameMap, territoryId: string): string[] {
  return Array.from(map.adjacency.get(territoryId) ?? []);
}

export function getPlayerTerritories(map: GameMap, playerId: string): Territory[] {
  return Array.from(map.territories.values()).filter(
    (t) => t.ownerId === playerId
  );
}

export function playerOwnsContinent(map: GameMap, playerId: string, continentId: string): boolean {
  const continent = map.continents.get(continentId);
  if (!continent) return false;
  return continent.territoryIds.every(
    (tid) => map.territories.get(tid)?.ownerId === playerId
  );
}
