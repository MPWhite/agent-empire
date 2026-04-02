import {
  type TechBranch,
  type TechLevels,
  type TechProgress,
  type Player,
  TECH_COSTS,
  MAX_TECH_LEVEL,
} from './types.js';

// ── Tech Tree Definitions ──

export interface TechNode {
  level: number;
  name: string;
  description: string;
}

export const TECH_TREE: Record<TechBranch, TechNode[]> = {
  military: [
    { level: 1, name: 'Fortifications', description: 'Can build forts' },
    { level: 2, name: 'Artillery', description: 'Ranged bombardment, reduce fort level' },
    { level: 3, name: 'Drones', description: 'Cheap scout/raid units' },
    { level: 4, name: 'Missiles', description: 'Strike non-adjacent territories (range 3)' },
    { level: 5, name: 'Nuclear Weapons', description: 'Devastating area attack + MAD' },
  ],
  economic: [
    { level: 1, name: 'Trade Networks', description: 'Unlock trade deals' },
    { level: 2, name: 'Resource Extraction', description: '+50% resource output' },
    { level: 3, name: 'Sanctions', description: 'Can propose sanctions' },
    { level: 4, name: 'Economic Espionage', description: 'Steal/sabotage economy' },
    { level: 5, name: 'Global Markets', description: 'Convert resources 2:1' },
  ],
  intelligence: [
    { level: 1, name: 'Scouts', description: 'See adjacent enemy troop counts' },
    { level: 2, name: 'Spy Network', description: 'See enemy proposals before voting' },
    { level: 3, name: 'Satellite Surveillance', description: 'Full visibility of one empire' },
    { level: 4, name: 'Cyberattack', description: 'Disable fort or tech for 1 turn' },
    { level: 5, name: 'Counter-Intelligence', description: 'Block enemy spies + detect them' },
  ],
};

// ── Functions ──

/**
 * Get the cost to reach the next level in a branch.
 * Returns null if already at max level.
 */
export function getResearchCost(currentLevel: number): { minerals: number; money: number } | null {
  const nextLevel = currentLevel + 1;
  if (nextLevel > MAX_TECH_LEVEL) return null;
  return TECH_COSTS[nextLevel];
}

/**
 * Check if a player can afford to research the next level in a branch.
 * Returns false if already at max level or if the player lacks resources
 * for even a single research point (1 mineral + 1 money).
 */
export function canAffordResearch(player: Player, branch: TechBranch): boolean {
  if (player.tech[branch] >= MAX_TECH_LEVEL) return false;
  return player.resources.minerals >= 1 && player.resources.money >= 1;
}

/**
 * Apply research: deduct resources, add to progress, check if level-up occurs.
 * Each research point costs 1 mineral + 1 money.
 * Returns the new tech level if leveled up, null otherwise.
 * Excess progress carries over to the next level.
 */
export function applyResearch(
  player: Player,
  techProgress: TechProgress,
  branch: TechBranch,
  investment: number,
): { newLevel: number | null; mineralsSpent: number; moneySpent: number } {
  if (player.tech[branch] >= MAX_TECH_LEVEL || investment <= 0) {
    return { newLevel: null, mineralsSpent: 0, moneySpent: 0 };
  }

  // Clamp investment to what the player can actually afford
  const affordable = Math.min(investment, player.resources.minerals, player.resources.money);
  if (affordable <= 0) {
    return { newLevel: null, mineralsSpent: 0, moneySpent: 0 };
  }

  // Deduct resources
  player.resources.minerals -= affordable;
  player.resources.money -= affordable;

  // Add progress
  techProgress[branch] += affordable;

  // Check for level-up(s) — excess carries over
  let newLevel: number | null = null;
  let currentLevel = player.tech[branch];

  while (currentLevel < MAX_TECH_LEVEL) {
    const cost = TECH_COSTS[currentLevel + 1];
    if (techProgress[branch] >= cost.minerals) {
      techProgress[branch] -= cost.minerals;
      currentLevel += 1;
      player.tech[branch] = currentLevel;
      newLevel = currentLevel;
    } else {
      break;
    }
  }

  return { newLevel, mineralsSpent: affordable, moneySpent: affordable };
}

/**
 * Check if a player has reached at least a specific tech level in a branch.
 */
export function hasTechLevel(player: Player, branch: TechBranch, level: number): boolean {
  return player.tech[branch] >= level;
}

/**
 * Get the description of what a tech level unlocks.
 * Returns an empty string for invalid branch/level combinations.
 */
export function getTechDescription(branch: TechBranch, level: number): string {
  const nodes = TECH_TREE[branch];
  const node = nodes.find((n) => n.level === level);
  return node ? `${node.name} — ${node.description}` : '';
}

/**
 * Create initial tech progress for a new player (all zeros).
 */
export function createInitialTechProgress(): TechProgress {
  return { military: 0, economic: 0, intelligence: 0 };
}
