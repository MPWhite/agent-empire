// Client-side type definitions mirroring the engine + server protocol
// We duplicate rather than import to avoid build complexity with the engine package

// ── Resources ──

export type ResourceType = 'oil' | 'minerals' | 'food' | 'money';

export interface Resources {
  oil: number;
  minerals: number;
  food: number;
  money: number;
}

// ── Tech ──

export type TechBranch = 'military' | 'economic' | 'intelligence';

export interface TechLevels {
  military: number;    // 0-5
  economic: number;    // 0-5
  intelligence: number; // 0-5
}

// ── Shortage Tracking ──

export interface ShortageCounters {
  oil: number;
  minerals: number;
  food: number;
}

// ── Terrain ──

export type Terrain = 'plains' | 'mountains' | 'coastal';

// ── Core Entities ──

export interface Territory {
  id: string;
  name: string;
  continentId: string;
  ownerId: string | null;
  troops: number;
  terrain: Terrain;
  resources: Partial<Resources>;
  fortLevel: number;       // 0-3
  falloutTurns: number;    // nuclear fallout countdown
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
  reputation: number;           // 0-100
  shortages: ShortageCounters;
}

// ── Diplomacy ──

export type AgreementType = 'tradeDeal' | 'nonAggressionPact' | 'militaryAlliance';

export interface Agreement {
  id: string;
  type: AgreementType;
  parties: [string, string];
  turnsRemaining: number | null; // null = indefinite
  createdAtTurn: number;
  tradeOffer?: { resource: ResourceType; amount: number };
  tradeRequest?: { resource: ResourceType; amount: number };
}

export interface Sanction {
  targetPlayerId: string;
  supporters: string[];
  imposedAtTurn: number;
}

export type UNResolutionType = 'nuclearBan' | 'demilitarizedZone' | 'ceasefire' | 'groupSanctions';

export interface UNResolution {
  id: string;
  type: UNResolutionType;
  proposedBy: string;
  votes: Record<string, 'yes' | 'no' | null>;
  turnsToVote: number;
  details?: {
    targetPlayerId?: string;
    targetContinentId?: string;
    durationTurns?: number;
  };
}

export interface ActiveResolution {
  type: UNResolutionType;
  turnsRemaining: number;
  details?: UNResolution['details'];
}

export interface DiplomaticMessage {
  id: string;
  fromPlayerId: string;
  toPlayerId: string;
  text: string;
  sentAtTurn: number;
  publicAtTurn: number;
  isPublic: boolean;
}

// ── Map & State ──

export interface SerializedGameMap {
  territories: Record<string, Territory>;
  continents: Record<string, Continent>;
  adjacency: Record<string, string[]>;
}

export type TurnPhase = 'observe' | 'discuss' | 'propose' | 'vote' | 'resolve';

export interface SerializedGameState {
  map: SerializedGameMap;
  players: Record<string, Player>;
  turnNumber: number;
  phase: 'waiting' | 'playing' | 'finished';
  turnPhase?: TurnPhase;
  phaseEndsAt?: string;
  agentCounts?: Record<string, number>;
  totalAgents?: number;
  maxTurns?: number;
  // Diplomacy
  agreements: Agreement[];
  sanctions: Sanction[];
  diplomaticMessages: DiplomaticMessage[];
  unResolutions: UNResolution[];
  activeResolutions: ActiveResolution[];
}

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

export type PlayerAction = AttackAction | ReinforceAction;

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
  reason?: 'elimination' | 'dominance' | 'timer';
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
  | ResourceProductionEvent
  | ShortageEvent;

// ── Narrative Types ──

export interface TurnNarrative {
  contextLines: Array<{
    eventIndex: number;
    context: string;
  }>;
  commsHighlights: CommsHighlight[];
}

export interface CommsHighlight {
  teamId: string;
  headline: string;
  quotes: Array<{
    agentName: string;
    teamId: string;
    text: string;
  }>;
  context: string;
  timestamp: number;
}

export interface SerializedTurnResult {
  state: SerializedGameState;
  events: GameEvent[];
  narrative?: TurnNarrative;
}

// Analyst reports (LLM-generated)
export interface AnalystReport {
  id: string;
  type: 'dispatch' | 'breaking';
  turnRange: [number, number];
  text: string;
  isStreaming: boolean;
  timestamp: number;
}

// ── History Types ──

export type MajorEventType = 'elimination' | 'continent_capture' | 'major_war' | 'game_start' | 'victory';

export interface MajorEvent {
  turnNumber: number;
  type: MajorEventType;
  territoryIds: string[];
  playerIds: string[];
  summary: string;
  label: string;
}

export interface TurnSnapshot {
  turnNumber: number;
  territories: Record<string, { ownerId: string | null; troops: number }>;
  players: Record<string, { isAlive: boolean }>;
}

export interface HistoryMetaMessage {
  type: 'history_meta';
  totalTurns: number;
  majorEvents: MajorEvent[];
  playerNames: Record<string, { name: string; color: string }>;
  currentSituation?: string;
}

export interface TurnSnapshotMessage {
  type: 'turn_snapshot';
  turnNumber: number;
  snapshot: TurnSnapshot;
}

// ── Team Chat Types ──

export interface ChatMessage {
  id: string;
  teamId: string;
  agentId: string;
  agentName: string;
  text: string;
  timestamp: number;
}

// ── Proposal & Voting Types ──

export interface Proposal {
  id: string;
  teamId: string;
  agentId: string;
  name: string;
  reinforce: { territoryId: string; troops: number }[];
  attack: { from: string; to: string; troops: number }[];
  submittedAt: number;
  votes: number;
}

// ── New Server Messages ──

export interface ChatMessageEvent {
  type: 'chat_message';
  message: ChatMessage;
}

export interface PhaseChangeEvent {
  type: 'phase_change';
  phase: TurnPhase;
  phaseEndsAt: string;
  turnNumber: number;
}

export interface ProposalUpdateEvent {
  type: 'proposal_update';
  teamId: string;
  proposals: Proposal[];
}

export interface VoteUpdateEvent {
  type: 'vote_update';
  teamId: string;
  proposals: Proposal[];
  totalVotes: number;
}

// Server messages
export type ServerMessage =
  | { type: 'game_state'; state: SerializedGameState }
  | { type: 'turn_result'; result: SerializedTurnResult }
  | { type: 'error'; message: string }
  | HistoryMetaMessage
  | TurnSnapshotMessage
  | ChatMessageEvent
  | PhaseChangeEvent
  | ProposalUpdateEvent
  | VoteUpdateEvent;
