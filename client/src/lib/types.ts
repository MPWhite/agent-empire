// Client-side type definitions mirroring the engine + server protocol
// We duplicate rather than import to avoid build complexity with the engine package

export interface Territory {
  id: string;
  name: string;
  continentId: string;
  ownerId: string | null;
  troops: number;
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
}

export interface SerializedGameMap {
  territories: Record<string, Territory>;
  continents: Record<string, Continent>;
  adjacency: Record<string, string[]>;
}

export interface SerializedGameState {
  map: SerializedGameMap;
  players: Record<string, Player>;
  turnNumber: number;
  phase: 'waiting' | 'playing' | 'finished';
}

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

// Events
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
}

export type GameEvent =
  | BattleEvent
  | ConquestEvent
  | ReinforcementEvent
  | EliminationEvent
  | VictoryEvent;

export interface SerializedTurnResult {
  state: SerializedGameState;
  events: GameEvent[];
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
}

export interface TurnSnapshotMessage {
  type: 'turn_snapshot';
  turnNumber: number;
  snapshot: TurnSnapshot;
}

// Server messages
export type ServerMessage =
  | { type: 'game_state'; state: SerializedGameState }
  | { type: 'turn_result'; result: SerializedTurnResult }
  | { type: 'error'; message: string }
  | HistoryMetaMessage
  | TurnSnapshotMessage;
