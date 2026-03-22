import type { GameState, GamePhase, PlayerAction, TurnResult, Player, Territory, Continent } from 'engine';

// ── Client → Server Messages ──

export interface SubmitActionsMessage {
  type: 'submit_actions';
  playerId: string;
  actions: PlayerAction[];
}

export interface EndTurnMessage {
  type: 'end_turn';
  playerId: string;
}

export interface NewGameMessage {
  type: 'new_game';
}

export type ClientMessage = SubmitActionsMessage | EndTurnMessage | NewGameMessage;

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

export type ServerMessage =
  | GameStateMessage
  | TurnResultMessage
  | ActionsAcknowledgedMessage
  | PlayerTurnEndedMessage
  | ErrorMessage;

// ── Serialization helpers ──
// Maps and Sets can't be JSON-serialized, so we convert them

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
}

export interface SerializedTurnResult {
  state: SerializedGameState;
  events: any[];
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
  };
}

export function deserializeGameState(data: SerializedGameState): GameState {
  const territories = new Map<string, Territory>();
  for (const [id, t] of Object.entries(data.map.territories)) {
    territories.set(id, t);
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
    players.set(id, p);
  }

  return {
    map: { territories, continents, adjacency },
    players,
    turnNumber: data.turnNumber,
    phase: data.phase as GamePhase,
  };
}

export function serializeTurnResult(result: TurnResult): SerializedTurnResult {
  return {
    state: serializeGameState(result.state),
    events: result.events,
  };
}
