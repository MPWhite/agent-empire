import type {
  GameState,
  WorldEvent,
  WorldEventType,
  Territory,
} from './types.js';
import { EVENT_MIN_INTERVAL, EVENT_MAX_INTERVAL } from './types.js';
import { getPlayerTerritories } from './map.js';

// ── Event Definitions ──

interface EventTemplate {
  type: WorldEventType;
  name: string;
  description: string;
  durationTurns: number; // 0 = instant
}

const EVENT_TEMPLATES: EventTemplate[] = [
  // Resource crises
  { type: 'oilShock', name: 'Oil Shock', description: 'Global oil production halved for 3 turns.', durationTurns: 3 },
  { type: 'famine', name: 'Famine', description: 'Food production drops to 0 in a random continent for 3 turns.', durationTurns: 3 },
  { type: 'mineralDiscovery', name: 'Mineral Discovery', description: 'A territory gains +3 mineral production permanently.', durationTurns: 0 },

  // Political events
  { type: 'revolution', name: 'Revolution', description: 'A territory with food shortage rebels — flips to neutral with rebel troops.', durationTurns: 0 },
  { type: 'defection', name: 'Defection', description: 'A low-reputation empire loses a border territory to a neighbor.', durationTurns: 0 },
  { type: 'armsRace', name: 'Arms Race', description: 'All empires get +100% research speed for 3 turns.', durationTurns: 3 },

  // Natural events
  { type: 'earthquake', name: 'Earthquake', description: 'A territory loses 50% troops and all fortifications.', durationTurns: 0 },
  { type: 'pandemic', name: 'Pandemic', description: 'Troops in a random continent cannot attack for 2 turns.', durationTurns: 2 },
  { type: 'climateShift', name: 'Climate Shift', description: "A territory's resource output changes permanently.", durationTurns: 0 },

  // Wild cards
  { type: 'mercenaryCompany', name: 'Mercenary Company', description: 'A neutral army spawns — highest bidder gets control for 5 turns.', durationTurns: 5 },
  { type: 'blackMarket', name: 'Black Market', description: 'Any empire can convert money to any resource at 3:1 for 3 turns.', durationTurns: 3 },
  { type: 'whistleblower', name: 'Whistleblower', description: 'All private diplomatic messages from the past 10 turns become public.', durationTurns: 0 },
];

// ── Event Pool (draw without replacement, reshuffle when exhausted) ──

let eventPool: WorldEventType[] = [];

function reshufflePool(seed: number): void {
  eventPool = EVENT_TEMPLATES.map((t) => t.type);
  // Fisher-Yates with deterministic seed
  let s = seed;
  for (let i = eventPool.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [eventPool[i], eventPool[j]] = [eventPool[j], eventPool[i]];
  }
}

function drawEvent(seed: number): WorldEventType {
  if (eventPool.length === 0) {
    reshufflePool(seed);
  }
  return eventPool.pop()!;
}

// ── Scheduling ──

/**
 * Calculate when the next event should be announced.
 * Returns a turn number between EVENT_MIN_INTERVAL and EVENT_MAX_INTERVAL
 * turns from now.
 */
export function scheduleNextEvent(currentTurn: number, seed: number): number {
  let s = (seed * 1664525 + 1013904223) & 0xffffffff;
  const range = EVENT_MAX_INTERVAL - EVENT_MIN_INTERVAL + 1;
  const offset = EVENT_MIN_INTERVAL + (Math.abs(s) % range);
  return currentTurn + offset;
}

// ── Event Generation ──

/**
 * Generate a world event to be announced this turn (activates next turn).
 */
export function generateEvent(state: GameState): WorldEvent | null {
  const eventType = drawEvent(state.turnNumber);
  const template = EVENT_TEMPLATES.find((t) => t.type === eventType);
  if (!template) return null;

  const details: Record<string, any> = {};

  // Add event-specific details
  switch (eventType) {
    case 'famine':
    case 'pandemic': {
      // Pick a random continent
      const continents = Array.from(state.map.continents.keys());
      const idx = Math.abs((state.turnNumber * 2654435761) & 0xffffffff) % continents.length;
      details.targetContinentId = continents[idx];
      details.targetContinentName = state.map.continents.get(continents[idx])?.name;
      break;
    }
    case 'mineralDiscovery':
    case 'earthquake':
    case 'climateShift': {
      // Pick a random territory
      const territories = Array.from(state.map.territories.values());
      const idx = Math.abs((state.turnNumber * 2246822519) & 0xffffffff) % territories.length;
      details.targetTerritoryId = territories[idx].id;
      details.targetTerritoryName = territories[idx].name;
      break;
    }
    case 'revolution': {
      // Find territories with food shortage
      const candidates: Territory[] = [];
      for (const [, player] of state.players) {
        if (!player.isAlive) continue;
        if (player.shortages.food >= 3) {
          const territories = getPlayerTerritories(state.map, player.id);
          candidates.push(...territories);
        }
      }
      if (candidates.length === 0) return null; // Can't fire this event
      const idx = Math.abs((state.turnNumber * 1103515245) & 0xffffffff) % candidates.length;
      details.targetTerritoryId = candidates[idx].id;
      details.targetTerritoryName = candidates[idx].name;
      details.rebelTroops = 5;
      break;
    }
    case 'defection': {
      // Find players with low reputation
      const lowRepPlayers = Array.from(state.players.values()).filter(
        (p) => p.isAlive && p.reputation < 20,
      );
      if (lowRepPlayers.length === 0) return null;
      const playerIdx = Math.abs((state.turnNumber * 1103515245) & 0xffffffff) % lowRepPlayers.length;
      const targetPlayer = lowRepPlayers[playerIdx];
      // Find a border territory
      const territories = getPlayerTerritories(state.map, targetPlayer.id);
      const borderTerritories = territories.filter((t) => {
        const neighbors = state.map.adjacency.get(t.id);
        if (!neighbors) return false;
        for (const n of neighbors) {
          const neighbor = state.map.territories.get(n);
          if (neighbor && neighbor.ownerId && neighbor.ownerId !== targetPlayer.id) return true;
        }
        return false;
      });
      if (borderTerritories.length === 0) return null;
      const terrIdx = Math.abs((state.turnNumber * 2654435761) & 0xffffffff) % borderTerritories.length;
      // Find which neighbor to defect to
      const defectTerritory = borderTerritories[terrIdx];
      const neighbors = Array.from(state.map.adjacency.get(defectTerritory.id) ?? []);
      const enemyNeighbors = neighbors.filter((n) => {
        const t = state.map.territories.get(n);
        return t && t.ownerId && t.ownerId !== targetPlayer.id;
      });
      if (enemyNeighbors.length === 0) return null;
      const neighborTerritory = state.map.territories.get(enemyNeighbors[0])!;
      details.targetTerritoryId = defectTerritory.id;
      details.targetTerritoryName = defectTerritory.name;
      details.fromPlayerId = targetPlayer.id;
      details.toPlayerId = neighborTerritory.ownerId;
      break;
    }
    case 'mercenaryCompany': {
      // Find a neutral territory or pick a random one
      const neutralTerritories = Array.from(state.map.territories.values()).filter(
        (t) => t.ownerId === null,
      );
      if (neutralTerritories.length > 0) {
        const idx = Math.abs((state.turnNumber * 2246822519) & 0xffffffff) % neutralTerritories.length;
        details.targetTerritoryId = neutralTerritories[idx].id;
      } else {
        // Pick a random border territory
        const territories = Array.from(state.map.territories.values());
        const idx = Math.abs((state.turnNumber * 2246822519) & 0xffffffff) % territories.length;
        details.targetTerritoryId = territories[idx].id;
      }
      details.mercenaryTroops = 15;
      details.hireCost = 30; // money
      break;
    }
  }

  return {
    id: `event-${state.turnNumber}-${eventType}`,
    type: eventType,
    name: template.name,
    description: template.description,
    announcedAtTurn: state.turnNumber,
    activeAtTurn: state.turnNumber + 1,
    durationTurns: template.durationTurns,
    turnsRemaining: template.durationTurns,
    details,
  };
}

// ── Event Application ──

/**
 * Apply an event's effects when it becomes active.
 * Modifies state in place. Returns a description of what happened.
 */
export function applyEvent(state: GameState, event: WorldEvent): string {
  switch (event.type) {
    case 'oilShock':
      // Handled during resource production — production check looks at active events
      return 'Oil Shock: global oil production halved for 3 turns.';

    case 'famine': {
      // Handled during resource production
      const name = event.details?.targetContinentName ?? 'a continent';
      return `Famine: food production drops to 0 in ${name} for 3 turns.`;
    }

    case 'mineralDiscovery': {
      const territory = state.map.territories.get(event.details?.targetTerritoryId);
      if (territory) {
        territory.resources = { ...territory.resources, minerals: (territory.resources.minerals ?? 0) + 3 };
      }
      const name = event.details?.targetTerritoryName ?? 'a territory';
      return `Mineral Discovery: ${name} gains +3 mineral production.`;
    }

    case 'revolution': {
      const territory = state.map.territories.get(event.details?.targetTerritoryId);
      if (territory && territory.ownerId) {
        territory.ownerId = null;
        territory.troops = event.details?.rebelTroops ?? 5;
        territory.fortLevel = 0;
      }
      const name = event.details?.targetTerritoryName ?? 'a territory';
      return `Revolution: ${name} rebels and becomes neutral with ${event.details?.rebelTroops ?? 5} rebel troops.`;
    }

    case 'defection': {
      const territory = state.map.territories.get(event.details?.targetTerritoryId);
      if (territory && event.details?.toPlayerId) {
        territory.ownerId = event.details.toPlayerId;
        // Keep existing troops
      }
      const name = event.details?.targetTerritoryName ?? 'a territory';
      return `Defection: ${name} defects to a neighboring empire.`;
    }

    case 'armsRace':
      // Handled during research resolution
      return 'Arms Race: all empires get +100% research speed for 3 turns.';

    case 'earthquake': {
      const territory = state.map.territories.get(event.details?.targetTerritoryId);
      if (territory) {
        territory.troops = Math.max(1, Math.floor(territory.troops * 0.5));
        territory.fortLevel = 0;
      }
      const name = event.details?.targetTerritoryName ?? 'a territory';
      return `Earthquake: ${name} loses 50% troops and all fortifications destroyed.`;
    }

    case 'pandemic':
      // Handled during attack validation — attacks from pandemic continent are blocked
      return `Pandemic: troops in ${event.details?.targetContinentName ?? 'a continent'} cannot attack for 2 turns.`;

    case 'climateShift': {
      const territory = state.map.territories.get(event.details?.targetTerritoryId);
      if (territory) {
        // Randomly reassign resources
        const possibleResources = ['oil', 'minerals', 'food', 'money'] as const;
        const seed = state.turnNumber * 3141592653;
        const s1 = Math.abs((seed * 1664525 + 1013904223) & 0xffffffff);
        const s2 = Math.abs((s1 * 1664525 + 1013904223) & 0xffffffff);
        const r1 = possibleResources[s1 % 4];
        const r2 = possibleResources[s2 % 4];
        territory.resources = { [r1]: 2, [r2]: 1 };
      }
      const name = event.details?.targetTerritoryName ?? 'a territory';
      return `Climate Shift: ${name}'s resource output has changed permanently.`;
    }

    case 'mercenaryCompany': {
      const territory = state.map.territories.get(event.details?.targetTerritoryId);
      if (territory && territory.ownerId === null) {
        territory.troops = event.details?.mercenaryTroops ?? 15;
      }
      return 'Mercenary Company: a neutral army of 15 troops has spawned, available for hire.';
    }

    case 'blackMarket':
      // Handled during resource conversion — players can convert money→resource at 3:1
      return 'Black Market: any empire can convert money to any resource at 3:1 ratio for 3 turns.';

    case 'whistleblower': {
      // Make all messages from past 10 turns public
      for (const msg of state.diplomaticMessages) {
        if (msg.sentAtTurn >= state.turnNumber - 10) {
          msg.isPublic = true;
        }
      }
      return 'Whistleblower: all private diplomatic messages from the past 10 turns are now public.';
    }

    default:
      return `Unknown event: ${event.type}`;
  }
}

// ── Event Queries ──

/**
 * Check if an event of a given type is currently active.
 */
export function isEventActive(events: WorldEvent[], type: WorldEventType, currentTurn: number): boolean {
  return events.some(
    (e) => e.type === type && e.activeAtTurn <= currentTurn && e.turnsRemaining > 0,
  );
}

/**
 * Get the active event of a given type, if any.
 */
export function getActiveEvent(events: WorldEvent[], type: WorldEventType, currentTurn: number): WorldEvent | undefined {
  return events.find(
    (e) => e.type === type && e.activeAtTurn <= currentTurn && e.turnsRemaining > 0,
  );
}

/**
 * Tick all active events — decrement turnsRemaining.
 * Returns events that just expired.
 */
export function tickEvents(events: WorldEvent[], currentTurn: number): {
  active: WorldEvent[];
  expired: WorldEvent[];
} {
  const active: WorldEvent[] = [];
  const expired: WorldEvent[] = [];

  for (const event of events) {
    if (event.activeAtTurn > currentTurn) {
      // Not yet active — keep as upcoming
      active.push(event);
    } else if (event.turnsRemaining > 0) {
      event.turnsRemaining--;
      if (event.turnsRemaining > 0) {
        active.push(event);
      } else {
        expired.push(event);
      }
    }
    // turnsRemaining === 0 means instant event, already applied — drop it
  }

  return { active, expired };
}
