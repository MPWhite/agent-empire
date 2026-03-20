import type { GameState, PlayerAction, TurnResult, Player } from 'engine';

// ── Client → Server Messages ──

export interface JoinMessage {
  type: 'join';
  playerId: string;
  name: string;
}

export interface SubmitActionsMessage {
  type: 'submit_actions';
  playerId: string;
  actions: PlayerAction[];
}

export interface StartGameMessage {
  type: 'start_game';
  playerId: string;
}

export type ClientMessage = JoinMessage | SubmitActionsMessage | StartGameMessage;

// ── Server → Client Messages ──

export interface GameStateMessage {
  type: 'game_state';
  state: SerializedGameState;
}

export interface TurnResultMessage {
  type: 'turn_result';
  result: SerializedTurnResult;
  nextTurnEndsAt: number;
}

export interface TimerTickMessage {
  type: 'timer_tick';
  secondsRemaining: number;
}

export interface PlayerJoinedMessage {
  type: 'player_joined';
  player: Player;
}

export interface PlayerLeftMessage {
  type: 'player_left';
  playerId: string;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ServerMessage =
  | GameStateMessage
  | TurnResultMessage
  | TimerTickMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | ErrorMessage;

// ── Serialization helpers ──
// Maps and Sets can't be JSON-serialized, so we convert them

export interface SerializedGameMap {
  territories: Record<string, any>;
  continents: Record<string, any>;
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
  const territories: Record<string, any> = {};
  for (const [id, t] of state.map.territories) {
    territories[id] = t;
  }

  const continents: Record<string, any> = {};
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

export function serializeTurnResult(result: TurnResult): SerializedTurnResult {
  return {
    state: serializeGameState(result.state),
    events: result.events,
  };
}
