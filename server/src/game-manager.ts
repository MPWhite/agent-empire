import { WebSocket } from 'ws';
import {
  createGame,
  assignTerritories,
  resolveTurn,
  type GameState,
  type PlayerAction,
} from 'engine';
import { saveGame, loadGame } from './persistence.js';
import {
  serializeGameState,
  serializeTurnResult,
  type ServerMessage,
  type ClientMessage,
} from './protocol.js';

const PLAYERS = [
  { id: 'p1', name: 'Player 1' },
  { id: 'p2', name: 'Player 2' },
  { id: 'p3', name: 'Player 3' },
  { id: 'p4', name: 'Player 4' },
  { id: 'p5', name: 'Player 5' },
  { id: 'p6', name: 'Player 6' },
  { id: 'p7', name: 'Player 7' },
  { id: 'p8', name: 'Player 8' },
];

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

    this.endedTurns.add(playerId);
    this.broadcast({ type: 'player_turn_ended', playerId });
    console.log(`${playerId} ended turn (${this.endedTurns.size}/${PLAYERS.length})`);

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
