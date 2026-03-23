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
  { id: 'p1', name: 'Voss' },
  { id: 'p2', name: 'Magnus' },
  { id: 'p3', name: 'Petra' },
  { id: 'p4', name: 'Khan' },
  { id: 'p5', name: 'Sato' },
  { id: 'p6', name: 'Cruz' },
  { id: 'p7', name: 'Odin' },
  { id: 'p8', name: 'Zara' },
];

const ALL_PLAYER_IDS = PLAYERS.map((p) => p.id);
const TURN_INTERVAL_MS = 2000;

export class GameManager {
  private state: GameState;
  private connections = new Set<WebSocket>();
  private autoPlayTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const loaded = loadGame();
    if (loaded) {
      this.state = loaded;
      console.log(`Loaded saved game — turn ${loaded.turnNumber}, phase: ${loaded.phase}`);
    } else {
      this.state = this.createFreshGame();
      console.log('Created new game');
    }
    this.startAutoPlay();
  }

  private createFreshGame(): GameState {
    const state = createGame(PLAYERS);
    const started = assignTerritories(state);
    saveGame(started);
    return started;
  }

  private startAutoPlay(): void {
    this.stopAutoPlay();
    if (this.state.phase !== 'playing') return;
    this.autoPlayTimer = setInterval(() => this.runOneTurn(), TURN_INTERVAL_MS);
    console.log(`Auto-play started (${TURN_INTERVAL_MS}ms interval)`);
  }

  private stopAutoPlay(): void {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  private runOneTurn(): void {
    if (this.state.phase !== 'playing') {
      this.stopAutoPlay();
      return;
    }

    // Generate actions for all alive players
    const allActions: PlayerAction[] = [];
    for (const pid of ALL_PLAYER_IDS) {
      const player = this.state.players.get(pid);
      if (!player || !player.isAlive) continue;
      const actions = generateAIActions(this.state, pid);
      allActions.push(...actions);
    }

    // Resolve the turn
    const result = resolveTurn(this.state, allActions);
    this.state = result.state;

    saveGame(this.state);

    this.broadcast({
      type: 'turn_result',
      result: serializeTurnResult(result),
    });

    console.log(`Turn ${result.state.turnNumber - 1} resolved. ${result.events.length} events.`);

    if (this.state.phase === 'finished') {
      this.stopAutoPlay();
      console.log('Game finished!');
    }
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
      case 'new_game':
        this.handleNewGame();
        break;
    }
  }

  private handleNewGame(): void {
    this.stopAutoPlay();
    this.state = this.createFreshGame();
    this.broadcast({ type: 'game_state', state: serializeGameState(this.state) });
    console.log('New game created');
    this.startAutoPlay();
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
