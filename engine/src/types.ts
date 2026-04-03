// ── Resource Types ──

export type ResourceType = 'oil' | 'minerals' | 'food' | 'money';

export interface Resources {
  oil: number;
  minerals: number;
  food: number;
  money: number;
}

export const EMPTY_RESOURCES: Readonly<Resources> = { oil: 0, minerals: 0, food: 0, money: 0 };
export const RESOURCE_STOCKPILE_CAP = 50;

// ── Terrain ──

export type Terrain = 'plains' | 'mountains' | 'coastal';

// ── Core Entity Types ──

export interface Territory {
  id: string;
  name: string;
  continentId: string;
  ownerId: string | null;
  troops: number;
  terrain: Terrain;
  resources: Partial<Resources>; // production per turn (e.g., { oil: 2, money: 1 })
  fortLevel: number;            // 0-3
  falloutTurns: number;         // turns of nuclear fallout remaining (0 = none)
}

export interface Continent {
  id: string;
  name: string;
  territoryIds: string[];
  bonusTroops: number;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  isAlive: boolean;
  resources: Resources;
  tech: TechLevels;
  reputation: number;           // 0-100, starts at 50
  shortages: ShortageCounters;  // consecutive turns without each resource
}

// ── Tech Tree ──

export type TechBranch = 'military' | 'economic' | 'intelligence';

export interface TechLevels {
  military: number;    // 0-5
  economic: number;    // 0-5
  intelligence: number; // 0-5
}

export interface TechProgress {
  military: number;    // accumulated research points toward next level
  economic: number;
  intelligence: number;
}

// Research costs: [minerals, money] per level
export const TECH_COSTS: Record<number, { minerals: number; money: number }> = {
  1: { minerals: 5, money: 5 },
  2: { minerals: 10, money: 10 },
  3: { minerals: 20, money: 15 },
  4: { minerals: 35, money: 25 },
  5: { minerals: 50, money: 40 },
};

export const MAX_TECH_LEVEL = 5;

// ── Shortage Tracking ──

export interface ShortageCounters {
  oil: number;
  minerals: number;
  food: number;
}

// Shortage thresholds
export const SHORTAGE_WARNING_TURNS = 2;   // turns 1-2: warning only
export const SHORTAGE_PENALTY_TURNS = 4;   // turns 3-4: -30% effectiveness
export const SHORTAGE_CRITICAL_TURNS = 5;  // turn 5+: hard lockout

// ── Diplomacy ──

export type AgreementType = 'tradeDeal' | 'nonAggressionPact' | 'militaryAlliance';

export interface Agreement {
  id: string;
  type: AgreementType;
  parties: [string, string]; // two player IDs
  turnsRemaining: number | null; // null = indefinite
  createdAtTurn: number;
  // Trade deal specifics
  tradeOffer?: { resource: ResourceType; amount: number };
  tradeRequest?: { resource: ResourceType; amount: number };
}

export interface Sanction {
  targetPlayerId: string;
  supporters: string[]; // player IDs supporting the sanction
  imposedAtTurn: number;
}

export type UNResolutionType = 'nuclearBan' | 'demilitarizedZone' | 'ceasefire' | 'groupSanctions';

export interface UNResolution {
  id: string;
  type: UNResolutionType;
  proposedBy: string;
  votes: Record<string, 'yes' | 'no' | null>; // playerId → vote
  turnsToVote: number; // turns remaining to collect votes
  details?: {
    targetPlayerId?: string;     // for groupSanctions
    targetContinentId?: string;  // for demilitarizedZone
    durationTurns?: number;      // for ceasefire / demilitarizedZone
  };
}

export interface ActiveResolution {
  type: UNResolutionType;
  turnsRemaining: number;
  details?: UNResolution['details'];
}

// Reputation thresholds
export const REPUTATION_INITIAL = 50;
export const REPUTATION_MAX = 100;
export const REPUTATION_RECOVERY_PER_TURN = 2;
export const REPUTATION_NO_TREATIES_THRESHOLD = 15;
export const REPUTATION_DEFECTION_THRESHOLD = 5;
export const REPUTATION_DOUBLE_COST_THRESHOLD = 30;

// Agreement breaking costs
export const BREAK_TRADE_DEAL_REPUTATION = 20;
export const BREAK_NAP_REPUTATION = 50;
export const BREAK_ALLIANCE_REPUTATION = 100;

// ── Diplomatic Messages ──

export interface DiplomaticMessage {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  text: string;
  sentAtTurn: number;
  publicAtTurn: number; // becomes public after 3 turns
  isPublic: boolean;
}

export const DIPLOMACY_MESSAGE_BASE_COST = 10;
export const DIPLOMACY_MESSAGE_INTEL1_COST = 5;
// Intel level 3+: free

// ── World Events ──

export type WorldEventType =
  | 'oilShock' | 'famine' | 'mineralDiscovery'
  | 'revolution' | 'defection' | 'armsRace'
  | 'earthquake' | 'pandemic' | 'climateShift'
  | 'mercenaryCompany' | 'blackMarket' | 'whistleblower';

export interface WorldEvent {
  id: string;
  type: WorldEventType;
  name: string;
  description: string;
  announcedAtTurn: number;  // announced 1 turn before activation
  activeAtTurn: number;     // when it takes effect
  durationTurns: number;    // how long the effect lasts (0 = instant)
  turnsRemaining: number;   // countdown during active period
  details?: Record<string, any>; // event-specific data (target continent, territory, etc.)
}

export const EVENT_MIN_INTERVAL = 8;
export const EVENT_MAX_INTERVAL = 12;

// ── Map & State ──

export interface GameMap {
  territories: Map<string, Territory>;
  continents: Map<string, Continent>;
  adjacency: Map<string, Set<string>>;
}

export interface GameState {
  map: GameMap;
  players: Map<string, Player>;
  turnNumber: number;
  phase: GamePhase;
  seed?: number;
  // New v2 state
  techProgress: Map<string, TechProgress>; // playerId → research progress
  agreements: Agreement[];
  sanctions: Sanction[];
  diplomaticMessages: DiplomaticMessage[];
  unResolutions: UNResolution[];
  activeResolutions: ActiveResolution[];
  events: WorldEvent[];           // upcoming + active events
  nextEventTurn: number;          // when the next event will be announced
}

export type GamePhase = 'waiting' | 'playing' | 'finished';

// ── Turn Phases (for team-based play) ──

export type TurnPhase = 'observe' | 'discuss' | 'propose' | 'vote' | 'resolve';

// Victory threshold: first empire to control this many territories wins
export const DOMINANCE_THRESHOLD = 70;
export const MAX_TURNS = 100;

// ── Actions ──

export interface AttackAction {
  type: 'attack';
  playerId: string;
  fromTerritoryId: string;
  toTerritoryId: string;
  troops: number;
}

export interface ReinforceAction {
  type: 'reinforce';
  playerId: string;
  territoryId: string;
  troops: number;
}

export interface ResearchAction {
  type: 'research';
  playerId: string;
  branch: TechBranch;
  investment: number; // resources to invest this turn
}

export interface BuildFortAction {
  type: 'buildFort';
  playerId: string;
  territoryId: string;
}

export interface LaunchMissileAction {
  type: 'launchMissile';
  playerId: string;
  targetTerritoryId: string;
}

export interface LaunchNukeAction {
  type: 'launchNuke';
  playerId: string;
  targetTerritoryId: string;
}

export interface TradeAction {
  type: 'trade';
  playerId: string;
  targetPlayerId: string;
  offer: { resource: ResourceType; amount: number };
  request: { resource: ResourceType; amount: number };
}

export interface SanctionAction {
  type: 'sanction';
  playerId: string;
  targetPlayerId: string;
}

export type SpyOperation = 'intel' | 'sabotage' | 'stealTech';

export interface SpyAction {
  type: 'spy';
  playerId: string;
  targetPlayerId: string;
  operation: SpyOperation;
}

export interface CyberattackAction {
  type: 'cyberattack';
  playerId: string;
  targetPlayerId: string;
  target: 'fort' | 'tech';
  territoryOrBranch: string; // territory ID for fort, branch name for tech
}

export type DiplomacyActionType = 'message' | 'proposeTreaty' | 'breakTreaty' | 'unVote';

export interface DiplomacyAction {
  type: 'diplomacy';
  playerId: string;
  diplomacyType: DiplomacyActionType;
  targetPlayerId?: string;
  // For messages
  messageText?: string;
  // For treaties
  treatyType?: AgreementType;
  treatyDuration?: number; // turns, or null for indefinite
  tradeOffer?: { resource: ResourceType; amount: number };
  tradeRequest?: { resource: ResourceType; amount: number };
  // For breaking treaties
  agreementId?: string;
  // For UN votes
  resolutionId?: string;
  vote?: 'yes' | 'no';
  // For proposing UN resolutions
  resolutionType?: UNResolutionType;
  resolutionDetails?: UNResolution['details'];
}

export type PlayerAction =
  | AttackAction
  | ReinforceAction
  | ResearchAction
  | BuildFortAction
  | LaunchMissileAction
  | LaunchNukeAction
  | TradeAction
  | SanctionAction
  | SpyAction
  | CyberattackAction
  | DiplomacyAction;

// ── Combat Constants ──

export const FORT_DEFENSE_BONUS = 0.20;       // +20% per fort level
export const MAX_FORT_LEVEL = 3;
export const MOUNTAIN_DEFENSE_BONUS = 0.50;    // +50% defense
export const ALLIANCE_DEFENSE_RATIO = 0.20;    // 20% of ally border troops
export const PACT_BREAKER_ATTACK_PENALTY = 0.20; // -20% attack power for 5 turns

// Missile constants
export const MISSILE_RANGE = 3;               // territory hops
export const MISSILE_TROOP_KILL_RATIO = 0.40; // destroys 40% of troops
export const MISSILE_OIL_COST = 5;
export const MISSILE_MINERAL_COST = 3;

// Nuclear constants
export const NUKE_OIL_COST = 20;
export const NUKE_MINERAL_COST = 20;
export const NUKE_PRIMARY_KILL_RATIO = 0.80;   // 80% troops in target
export const NUKE_COLLATERAL_KILL_RATIO = 0.30; // 30% troops in adjacent
export const NUKE_FALLOUT_TURNS = 10;           // no resource production
export const NUKE_WAR_ECONOMY_TURNS = 3;        // double resources for non-nuclear empires
export const NUKE_WAR_ECONOMY_MULTIPLIER = 2;

// Fort building cost
export const FORT_MINERAL_COST = 10;

// Troop recruitment cost
export const TROOP_MONEY_COST = 1;

// ── Events ──

export interface BattleEvent {
  type: 'battle';
  attackerId: string;
  defenderId: string;
  fromTerritoryId: string;
  toTerritoryId: string;
  attackerTroops: number;
  defenderTroops: number;
  attackerLosses: number;
  defenderLosses: number;
  conquered: boolean;
}

export interface ConquestEvent {
  type: 'conquest';
  playerId: string;
  territoryId: string;
  troopsMoved: number;
}

export interface ReinforcementEvent {
  type: 'reinforcement';
  playerId: string;
  territoryId: string;
  troops: number;
}

export interface EliminationEvent {
  type: 'elimination';
  playerId: string;
  eliminatedBy: string;
}

export interface VictoryEvent {
  type: 'victory';
  playerId: string;
  reason: 'elimination' | 'dominance' | 'timer';
}

export interface ResearchEvent {
  type: 'research';
  playerId: string;
  branch: TechBranch;
  newLevel: number;
}

export interface MissileStrikeEvent {
  type: 'missileStrike';
  attackerId: string;
  targetTerritoryId: string;
  troopsDestroyed: number;
  fortReduced: boolean;
}

export interface NukeEvent {
  type: 'nuke';
  attackerId: string;
  targetTerritoryId: string;
  primaryTroopsDestroyed: number;
  collateralTerritories: string[];
  retaliations: { playerId: string; targetTerritoryId: string; troopsDestroyed: number }[];
}

export interface DiplomacyEvent {
  type: 'diplomacyEvent';
  subtype: 'agreementFormed' | 'agreementBroken' | 'sanctionImposed' | 'sanctionLifted' | 'resolutionPassed' | 'resolutionFailed';
  playerId: string;
  targetPlayerId?: string;
  details?: string;
}

export interface SpyEvent {
  type: 'spyEvent';
  subtype: 'intelGathered' | 'sabotageSuccess' | 'sabotageFailed' | 'techStolen' | 'spyDetected';
  attackerId: string;
  targetId: string;
  details?: string;
}

export interface WorldEventOccurrence {
  type: 'worldEvent';
  event: WorldEvent;
}

export interface ResourceProductionEvent {
  type: 'resourceProduction';
  playerId: string;
  produced: Resources;
}

export interface ShortageEvent {
  type: 'shortage';
  playerId: string;
  resource: ResourceType;
  consecutiveTurns: number;
  effect: 'warning' | 'penalty' | 'critical';
}

export type GameEvent =
  | BattleEvent
  | ConquestEvent
  | ReinforcementEvent
  | EliminationEvent
  | VictoryEvent
  | ResearchEvent
  | MissileStrikeEvent
  | NukeEvent
  | DiplomacyEvent
  | SpyEvent
  | WorldEventOccurrence
  | ResourceProductionEvent
  | ShortageEvent;

// ── Turn Result ──

export interface TurnResult {
  state: GameState;
  events: GameEvent[];
}
