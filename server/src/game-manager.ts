import { WebSocket } from 'ws';
import {
  createGame,
  assignTerritories,
  resolveTurn,
  type GameState,
  type PlayerAction,
} from 'engine';
import { generateAIActions } from './ai/index.js';
import { saveGame, loadGame } from './persistence.js';
import {
  serializeGameState,
  serializeTurnResult,
  type ServerMessage,
  type ClientMessage,
} from './protocol.js';

const PLAYERS = [
  { id: 'p1', name: 'You' },
  { id: 'p2', name: 'AI Magnus' },
  { id: 'p3', name: 'AI Petra' },
  { id: 'p4', name: 'AI Khan' },
  { id: 'p5', name: 'AI Sato' },
  { id: 'p6', name: 'AI Cruz' },
  { id: 'p7', name: 'AI Odin' },
  { id: 'p8', name: 'AI Zara' },
];

const HUMAN_PLAYER_ID = 'p1';
const AI_PLAYER_IDS = new Set(['p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']);

export class GameManager {
  private state: GameState;
  private connections = new Set<WebSocket>();
  private pendingActions = new Map<string, PlayerAction[]>();
  private endedTurns = new Set<string>();

  constructor() {
    const loaded = loadGame();
    if (loaded) {
      this.state = loaded;
      console.log(`Loaded saved game — turn ${loaded.turnNumber}, phase: ${loaded.phase}`);
    } else {
      this.state = this.createFreshGame();
      console.log('Created new game');
    }
  }

  private createFreshGame(): GameState {
    const state = createGame(PLAYERS);
    const started = assignTerritories(state);
    saveGame(started);
    return started;
  }

  handleConnection(ws: WebSocket): void {
    this.connections.add(ws);

    // Immediately send current game state
    this.send(ws, { type: 'game_state', state: serializeGameState(this.state) });

    ws.on('message', (data) => {
      try {
        const msg: ClientMessage = JSON.parse(data.toString());
        this.handleMessage(ws, msg);
      } catch {
        this.send(ws, { type: 'error', message: 'Invalid message format' });
      }
    });

    ws.on('close', () => {
      this.connections.delete(ws);
    });
  }

  private handleMessage(_ws: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case 'submit_actions':
        this.handleSubmitActions(msg.playerId, msg.actions);
        break;
      case 'end_turn':
        this.handleEndTurn(msg.playerId);
        break;
      case 'new_game':
        this.handleNewGame();
        break;
    }
  }

  private handleSubmitActions(playerId: string, actions: PlayerAction[]): void {
    if (AI_PLAYER_IDS.has(playerId)) return;
    if (this.state.phase !== 'playing') {
      this.broadcast({ type: 'error', message: 'Game is not in progress' });
      return;
    }

    this.pendingActions.set(playerId, actions);
    this.broadcast({ type: 'actions_acknowledged', playerId, count: actions.length });
    console.log(`${playerId} submitted ${actions.length} actions`);
  }

  private handleEndTurn(playerId: string): void {
    if (this.state.phase !== 'playing') return;
    if (AI_PLAYER_IDS.has(playerId)) return;

    this.endedTurns.add(playerId);
    this.broadcast({ type: 'player_turn_ended', playerId });
    console.log(`${playerId} ended turn (${this.endedTurns.size}/${PLAYERS.length})`);

    // When human ends turn, trigger all AI players
    if (playerId === HUMAN_PLAYER_ID) {
      this.runAIPlayers();
    }

    // Resolve when all players have ended their turn
    if (this.endedTurns.size >= PLAYERS.length) {
      this.resolveTurn();
    }
  }

  private resolveTurn(): void {
    const allActions: PlayerAction[] = [];
    for (const actions of this.pendingActions.values()) {
      allActions.push(...actions);
    }

    const result = resolveTurn(this.state, allActions);
    this.state = result.state;
    this.pendingActions.clear();
    this.endedTurns.clear();

    saveGame(this.state);

    this.broadcast({
      type: 'turn_result',
      result: serializeTurnResult(result),
    });

    console.log(`Turn ${result.state.turnNumber - 1} resolved. ${result.events.length} events.`);

    if (this.state.phase === 'finished') {
      console.log('Game finished!');
    }
  }

  private runAIPlayers(): void {
    for (const aiId of AI_PLAYER_IDS) {
      const player = this.state.players.get(aiId);
      if (!player || !player.isAlive) continue;
      if (this.endedTurns.has(aiId)) continue;

      const actions = generateAIActions(this.state, aiId);
      this.pendingActions.set(aiId, actions);
      this.endedTurns.add(aiId);

      this.broadcast({ type: 'actions_acknowledged', playerId: aiId, count: actions.length });
      this.broadcast({ type: 'player_turn_ended', playerId: aiId });
      console.log(`AI ${aiId} submitted ${actions.length} actions`);
    }
  }

  private handleNewGame(): void {
    this.state = this.createFreshGame();
    this.pendingActions.clear();
    this.endedTurns.clear();
    this.broadcast({ type: 'game_state', state: serializeGameState(this.state) });
    console.log('New game created');
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const ws of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }
}
