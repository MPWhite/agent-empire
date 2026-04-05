import type {
  GameState,
  GamePhase,
  Player,
  Territory,
  Continent,
  TurnResult,
  TechProgress,
  Agreement,
  Sanction,
  DiplomaticMessage,
  UNResolution,
  ActiveResolution,
  WorldEvent,
  Resources,
} from 'engine';
import { EMPTY_RESOURCES } from 'engine';
import type { MajorEvent, TurnSnapshot } from './history.js';
import type { TurnNarrative } from './narrative-engine.js';

// ── Client → Server Messages ──

export interface NewGameMessage {
  type: 'new_game';
}

export interface RequestHistoryMessage {
  type: 'request_history';
}

export interface RequestTurnMessage {
  type: 'request_turn';
  turnNumber: number;
}

export type ClientMessage = NewGameMessage | RequestHistoryMessage | RequestTurnMessage;

// ── Server → Client Messages ──

export interface GameStateMessage {
  type: 'game_state';
  state: SerializedGameState;
}

export interface TurnResultMessage {
  type: 'turn_result';
  result: SerializedTurnResult;
}

export interface ActionsAcknowledgedMessage {
  type: 'actions_acknowledged';
  playerId: string;
  count: number;
}

export interface PlayerTurnEndedMessage {
  type: 'player_turn_ended';
  playerId: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
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

export type ServerMessage =
  | GameStateMessage
  | TurnResultMessage
  | ActionsAcknowledgedMessage
  | PlayerTurnEndedMessage
  | ErrorMessage
  | HistoryMetaMessage
  | TurnSnapshotMessage;

// ── Serialization helpers ──

export interface SerializedGameMap {
  territories: Record<string, Territory>;
  continents: Record<string, Continent>;
  adjacency: Record<string, string[]>;
}

export interface SerializedGameState {
  map: SerializedGameMap;
  players: Record<string, Player>;
  turnNumber: number;
  phase: string;
  // V2 additions
  agreements: Agreement[];
  sanctions: Sanction[];
  diplomaticMessages: DiplomaticMessage[];
  unResolutions: UNResolution[];
  activeResolutions: ActiveResolution[];
  events: WorldEvent[];
  nextEventTurn: number;
}

export interface SerializedTurnResult {
  state: SerializedGameState;
  events: any[];
  narrative?: TurnNarrative;
}

export function serializeGameState(state: GameState): SerializedGameState {
  const territories: Record<string, Territory> = {};
  for (const [id, t] of state.map.territories) {
    territories[id] = t;
  }

  const continents: Record<string, Continent> = {};
  for (const [id, c] of state.map.continents) {
    continents[id] = c;
  }

  const adjacency: Record<string, string[]> = {};
  for (const [id, neighbors] of state.map.adjacency) {
    adjacency[id] = Array.from(neighbors);
  }

  const players: Record<string, Player> = {};
  for (const [id, p] of state.players) {
    players[id] = p;
  }

  return {
    map: { territories, continents, adjacency },
    players,
    turnNumber: state.turnNumber,
    phase: state.phase,
    agreements: state.agreements,
    sanctions: state.sanctions,
    diplomaticMessages: state.diplomaticMessages,
    unResolutions: state.unResolutions,
    activeResolutions: state.activeResolutions,
    events: state.events,
    nextEventTurn: state.nextEventTurn,
  };
}

export function deserializeGameState(data: SerializedGameState): GameState {
  const territories = new Map<string, Territory>();
  for (const [id, t] of Object.entries(data.map.territories)) {
    // Ensure v2 fields exist with defaults for backward compatibility
    territories.set(id, {
      ...{ terrain: 'plains' as const, resources: {}, fortLevel: 0, falloutTurns: 0 },
      ...t,
    });
  }

  const continents = new Map<string, Continent>();
  for (const [id, c] of Object.entries(data.map.continents)) {
    continents.set(id, c);
  }

  const adjacency = new Map<string, Set<string>>();
  for (const [id, neighbors] of Object.entries(data.map.adjacency)) {
    adjacency.set(id, new Set(neighbors));
  }

  const players = new Map<string, Player>();
  for (const [id, p] of Object.entries(data.players)) {
    // Ensure v2 fields exist with defaults
    const defaults = {
      resources: { ...EMPTY_RESOURCES },
      tech: { military: 0, economic: 0, intelligence: 0 },
      reputation: 50,
      shortages: { oil: 0, minerals: 0, food: 0 },
    };
    players.set(id, { ...defaults, ...p });
  }

  // Deserialize techProgress (not stored in serialized state — reconstruct)
  const techProgress = new Map<string, TechProgress>();
  for (const [id] of players) {
    techProgress.set(id, { military: 0, economic: 0, intelligence: 0 });
  }

  return {
    map: { territories, continents, adjacency },
    players,
    turnNumber: data.turnNumber,
    phase: data.phase as GamePhase,
    techProgress,
    agreements: data.agreements ?? [],
    sanctions: data.sanctions ?? [],
    diplomaticMessages: data.diplomaticMessages ?? [],
    unResolutions: data.unResolutions ?? [],
    activeResolutions: data.activeResolutions ?? [],
    events: data.events ?? [],
    nextEventTurn: data.nextEventTurn ?? 10,
  };
}

export function serializeTurnResult(result: TurnResult): SerializedTurnResult {
  return {
    state: serializeGameState(result.state),
    events: result.events,
  };
}
