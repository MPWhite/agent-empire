import type { GameState, Player, Resources, ResourceType, ShortageCounters, Territory } from './types.js';
import {
  EMPTY_RESOURCES,
  RESOURCE_STOCKPILE_CAP,
  SHORTAGE_WARNING_TURNS,
  SHORTAGE_PENALTY_TURNS,
  SHORTAGE_CRITICAL_TURNS,
} from './types.js';
import { getPlayerTerritories } from './map.js';

// ── Shortage Effect ──

export interface ShortageEffect {
  resource: ResourceType;
  consecutiveTurns: number;
  effect: 'warning' | 'penalty' | 'critical';
}

// ── Helpers ──

export function clampResources(resources: Resources): Resources {
  return {
    oil: Math.min(resources.oil, RESOURCE_STOCKPILE_CAP),
    minerals: Math.min(resources.minerals, RESOURCE_STOCKPILE_CAP),
    food: Math.min(resources.food, RESOURCE_STOCKPILE_CAP),
    money: Math.min(resources.money, RESOURCE_STOCKPILE_CAP),
  };
}

export function createInitialResources(): Resources {
  return { ...EMPTY_RESOURCES };
}

// ── Production ──

/**
 * Calculate total resource production for a player from their territories.
 * Territories with falloutTurns > 0 produce nothing.
 * Economic tech level 2+ (Resource Extraction) gives +50% production.
 */
export function calculateProduction(state: GameState, playerId: string): Resources {
  const player = state.players.get(playerId);
  if (!player) return { ...EMPTY_RESOURCES };

  const territories = getPlayerTerritories(state.map, playerId);

  const base: Resources = { oil: 0, minerals: 0, food: 0, money: 0 };

  for (const territory of territories) {
    if (territory.falloutTurns > 0) continue;

    const res = territory.resources;
    if (res.oil) base.oil += res.oil;
    if (res.minerals) base.minerals += res.minerals;
    if (res.food) base.food += res.food;
    if (res.money) base.money += res.money;
  }

  // Economic tech level 2+ gives +50% production
  if (player.tech.economic >= 2) {
    base.oil = Math.floor(base.oil * 1.5);
    base.minerals = Math.floor(base.minerals * 1.5);
    base.food = Math.floor(base.food * 1.5);
    base.money = Math.floor(base.money * 1.5);
  }

  return base;
}

/**
 * Apply production to a player's stockpile, respecting the cap.
 * Returns the actual amount added (after capping).
 */
export function applyProduction(player: Player, production: Resources): Resources {
  const added: Resources = { oil: 0, minerals: 0, food: 0, money: 0 };

  for (const key of ['oil', 'minerals', 'food', 'money'] as const) {
    const before = player.resources[key];
    player.resources[key] = Math.min(before + production[key], RESOURCE_STOCKPILE_CAP);
    added[key] = player.resources[key] - before;
  }

  return added;
}

// ── Shortages ──

/**
 * Check and update shortage counters.
 * A shortage occurs when a resource stockpile is 0 AFTER production.
 * When the resource is available again, the counter resets to 0.
 */
export function updateShortages(player: Player): {
  shortages: ShortageCounters;
  effects: ShortageEffect[];
} {
  const effects: ShortageEffect[] = [];
  const shortageResources: (keyof ShortageCounters)[] = ['oil', 'minerals', 'food'];

  for (const resource of shortageResources) {
    if (player.resources[resource] === 0) {
      player.shortages[resource] += 1;
      const turns = player.shortages[resource];

      let effect: ShortageEffect['effect'];
      if (turns >= SHORTAGE_CRITICAL_TURNS) {
        effect = 'critical';
      } else if (turns > SHORTAGE_WARNING_TURNS) {
        effect = 'penalty';
      } else {
        effect = 'warning';
      }

      effects.push({ resource, consecutiveTurns: turns, effect });
    } else {
      // Resource available — reset counter
      player.shortages[resource] = 0;
    }
  }

  return { shortages: player.shortages, effects };
}

/**
 * Get the shortage penalty multiplier for a resource.
 * 1.0 = no penalty, 0.7 = 30% reduction, 0.0 = hard lockout.
 */
export function getShortagePenalty(shortageCounters: ShortageCounters, resource: ResourceType): number {
  // Money has no shortage penalty
  if (resource === 'money') return 1.0;

  const turns = shortageCounters[resource as keyof ShortageCounters];
  if (turns === undefined) return 1.0;

  if (turns >= SHORTAGE_CRITICAL_TURNS) return 0;
  if (turns > SHORTAGE_WARNING_TURNS) return 0.7;
  return 1.0;
}

// ── Resource Transactions ──

/**
 * Check if a player can afford a cost.
 */
export function canAfford(player: Player, cost: Partial<Resources>): boolean {
  for (const key of ['oil', 'minerals', 'food', 'money'] as const) {
    const amount = cost[key] ?? 0;
    if (player.resources[key] < amount) return false;
  }
  return true;
}

/**
 * Deduct resources from a player's stockpile.
 * Returns false if the player can't afford the cost (no resources deducted).
 */
export function deductResources(player: Player, cost: Partial<Resources>): boolean {
  if (!canAfford(player, cost)) return false;

  for (const key of ['oil', 'minerals', 'food', 'money'] as const) {
    const amount = cost[key] ?? 0;
    player.resources[key] -= amount;
  }
  return true;
}

/**
 * Add resources to a player's stockpile (respecting the cap).
 */
export function addResources(player: Player, resources: Partial<Resources>): void {
  for (const key of ['oil', 'minerals', 'food', 'money'] as const) {
    const amount = resources[key] ?? 0;
    player.resources[key] = Math.min(player.resources[key] + amount, RESOURCE_STOCKPILE_CAP);
  }
}
