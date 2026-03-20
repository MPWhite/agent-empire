export type {
  Territory,
  Continent,
  Player,
  GameMap,
  GameState,
  GamePhase,
  AttackAction,
  ReinforceAction,
  PlayerAction,
  BattleEvent,
  ConquestEvent,
  ReinforcementEvent,
  EliminationEvent,
  VictoryEvent,
  GameEvent,
  TurnResult,
} from './types.js';

export {
  createDefaultMap,
  areAdjacent,
  getNeighbors,
  getPlayerTerritories,
  playerOwnsContinent,
} from './map.js';

export { validateAction } from './validation.js';
export { resolveCombat } from './combat.js';
export { calculateReinforcements } from './reinforcements.js';
export { resolveTurn } from './turn.js';
export { createGame, assignTerritories } from './game.js';
