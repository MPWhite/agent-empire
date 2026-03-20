// ── Core Entity Types ──

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
}

export type GamePhase = 'waiting' | 'playing' | 'finished';

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
}

export type GameEvent =
  | BattleEvent
  | ConquestEvent
  | ReinforcementEvent
  | EliminationEvent
  | VictoryEvent;

// ── Turn Result ──

export interface TurnResult {
  state: GameState;
  events: GameEvent[];
}
