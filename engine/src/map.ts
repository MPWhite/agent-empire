import type { GameMap, Territory, Continent } from './types.js';

// ── Raw Map Data (Classic Risk – 42 territories, 6 continents) ──

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
  { id: 'north_america', name: 'North America', bonusTroops: 5 },
  { id: 'south_america', name: 'South America', bonusTroops: 2 },
  { id: 'europe', name: 'Europe', bonusTroops: 5 },
  { id: 'africa', name: 'Africa', bonusTroops: 3 },
  { id: 'asia', name: 'Asia', bonusTroops: 7 },
  { id: 'australia', name: 'Australia', bonusTroops: 2 },
];

const TERRITORIES: TerritoryDef[] = [
  // North America (9)
  { id: 'alaska', name: 'Alaska', continentId: 'north_america' },
  { id: 'northwest', name: 'NW Territory', continentId: 'north_america' },
  { id: 'greenland', name: 'Greenland', continentId: 'north_america' },
  { id: 'alberta', name: 'Alberta', continentId: 'north_america' },
  { id: 'ontario', name: 'Ontario', continentId: 'north_america' },
  { id: 'quebec', name: 'Quebec', continentId: 'north_america' },
  { id: 'western_us', name: 'Western US', continentId: 'north_america' },
  { id: 'eastern_us', name: 'Eastern US', continentId: 'north_america' },
  { id: 'central_america', name: 'C. America', continentId: 'north_america' },

  // South America (4)
  { id: 'venezuela', name: 'Venezuela', continentId: 'south_america' },
  { id: 'brazil', name: 'Brazil', continentId: 'south_america' },
  { id: 'peru', name: 'Peru', continentId: 'south_america' },
  { id: 'argentina', name: 'Argentina', continentId: 'south_america' },

  // Europe (7)
  { id: 'iceland', name: 'Iceland', continentId: 'europe' },
  { id: 'great_britain', name: 'Gr. Britain', continentId: 'europe' },
  { id: 'scandinavia', name: 'Scandinavia', continentId: 'europe' },
  { id: 'north_europe', name: 'N. Europe', continentId: 'europe' },
  { id: 'west_europe', name: 'W. Europe', continentId: 'europe' },
  { id: 'south_europe', name: 'S. Europe', continentId: 'europe' },
  { id: 'ukraine', name: 'Ukraine', continentId: 'europe' },

  // Africa (6)
  { id: 'north_africa', name: 'N. Africa', continentId: 'africa' },
  { id: 'egypt', name: 'Egypt', continentId: 'africa' },
  { id: 'east_africa', name: 'E. Africa', continentId: 'africa' },
  { id: 'congo', name: 'Congo', continentId: 'africa' },
  { id: 'south_africa', name: 'S. Africa', continentId: 'africa' },
  { id: 'madagascar', name: 'Madagascar', continentId: 'africa' },

  // Asia (12)
  { id: 'ural', name: 'Ural', continentId: 'asia' },
  { id: 'siberia', name: 'Siberia', continentId: 'asia' },
  { id: 'yakutsk', name: 'Yakutsk', continentId: 'asia' },
  { id: 'irkutsk', name: 'Irkutsk', continentId: 'asia' },
  { id: 'kamchatka', name: 'Kamchatka', continentId: 'asia' },
  { id: 'afghanistan', name: 'Afghanistan', continentId: 'asia' },
  { id: 'china', name: 'China', continentId: 'asia' },
  { id: 'mongolia', name: 'Mongolia', continentId: 'asia' },
  { id: 'japan', name: 'Japan', continentId: 'asia' },
  { id: 'middle_east', name: 'Middle East', continentId: 'asia' },
  { id: 'india', name: 'India', continentId: 'asia' },
  { id: 'siam', name: 'Siam', continentId: 'asia' },

  // Australia (4)
  { id: 'indonesia', name: 'Indonesia', continentId: 'australia' },
  { id: 'new_guinea', name: 'New Guinea', continentId: 'australia' },
  { id: 'western_australia', name: 'W. Australia', continentId: 'australia' },
  { id: 'eastern_australia', name: 'E. Australia', continentId: 'australia' },
];

// Adjacency list — bidirectional edges (classic Risk board)
const EDGES: [string, string][] = [
  // North America internal
  ['alaska', 'northwest'],
  ['alaska', 'alberta'],
  ['northwest', 'alberta'],
  ['northwest', 'ontario'],
  ['northwest', 'greenland'],
  ['alberta', 'ontario'],
  ['alberta', 'western_us'],
  ['ontario', 'quebec'],
  ['ontario', 'eastern_us'],
  ['ontario', 'western_us'],
  ['ontario', 'greenland'],
  ['quebec', 'eastern_us'],
  ['quebec', 'greenland'],
  ['western_us', 'eastern_us'],
  ['western_us', 'central_america'],
  ['eastern_us', 'central_america'],

  // South America internal
  ['venezuela', 'brazil'],
  ['venezuela', 'peru'],
  ['brazil', 'peru'],
  ['brazil', 'argentina'],
  ['peru', 'argentina'],

  // Europe internal
  ['iceland', 'great_britain'],
  ['iceland', 'scandinavia'],
  ['great_britain', 'scandinavia'],
  ['great_britain', 'north_europe'],
  ['great_britain', 'west_europe'],
  ['scandinavia', 'north_europe'],
  ['scandinavia', 'ukraine'],
  ['north_europe', 'west_europe'],
  ['north_europe', 'south_europe'],
  ['north_europe', 'ukraine'],
  ['west_europe', 'south_europe'],
  ['south_europe', 'ukraine'],

  // Africa internal
  ['north_africa', 'egypt'],
  ['north_africa', 'east_africa'],
  ['north_africa', 'congo'],
  ['egypt', 'east_africa'],
  ['east_africa', 'congo'],
  ['east_africa', 'south_africa'],
  ['east_africa', 'madagascar'],
  ['congo', 'south_africa'],
  ['south_africa', 'madagascar'],

  // Asia internal
  ['ural', 'siberia'],
  ['ural', 'afghanistan'],
  ['ural', 'china'],
  ['siberia', 'yakutsk'],
  ['siberia', 'irkutsk'],
  ['siberia', 'mongolia'],
  ['siberia', 'china'],
  ['yakutsk', 'irkutsk'],
  ['yakutsk', 'kamchatka'],
  ['irkutsk', 'kamchatka'],
  ['irkutsk', 'mongolia'],
  ['kamchatka', 'mongolia'],
  ['kamchatka', 'japan'],
  ['afghanistan', 'china'],
  ['afghanistan', 'india'],
  ['china', 'mongolia'],
  ['china', 'india'],
  ['china', 'siam'],
  ['mongolia', 'japan'],
  ['india', 'siam'],

  // Australia internal
  ['indonesia', 'new_guinea'],
  ['indonesia', 'western_australia'],
  ['new_guinea', 'western_australia'],
  ['new_guinea', 'eastern_australia'],
  ['western_australia', 'eastern_australia'],

  // Cross-continent bridges
  ['alaska', 'kamchatka'],           // NA ↔ Asia
  ['greenland', 'iceland'],          // NA ↔ Europe
  ['central_america', 'venezuela'],  // NA ↔ SA
  ['brazil', 'north_africa'],        // SA ↔ Africa
  ['west_europe', 'north_africa'],   // Europe ↔ Africa
  ['south_europe', 'north_africa'],  // Europe ↔ Africa
  ['south_europe', 'egypt'],         // Europe ↔ Africa
  ['ukraine', 'ural'],               // Europe ↔ Asia
  ['ukraine', 'afghanistan'],        // Europe ↔ Asia
  ['ukraine', 'middle_east'],        // Europe ↔ Asia
  ['south_europe', 'middle_east'],   // Europe ↔ Asia
  ['egypt', 'middle_east'],          // Africa ↔ Asia
  ['east_africa', 'middle_east'],    // Africa ↔ Asia
  ['middle_east', 'india'],          // Asia internal (already in Asia)
  ['siam', 'indonesia'],             // Asia ↔ Australia
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
