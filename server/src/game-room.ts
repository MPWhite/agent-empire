import { WebSocket } from 'ws';
import {
  createGame,
  assignTerritories,
  resolveTurn,
  type GameState,
  type PlayerAction,
  type Player,
} from 'engine';
import { TurnTimer } from './timer.js';
import {
  serializeGameState,
  serializeTurnResult,
  type ServerMessage,
  type ClientMessage,
} from './protocol.js';

interface ConnectedPlayer {
  ws: WebSocket;
  playerId: string;
  name: string;
}

export class GameRoom {
  private state: GameState | null = null;
  private connections = new Map<string, ConnectedPlayer>();
  private spectators = new Set<WebSocket>();
  private pendingActions = new Map<string, PlayerAction[]>();
  private timer: TurnTimer;
  private turnDurationSeconds: number;

  constructor(opts: { turnDurationSeconds?: number } = {}) {
    this.turnDurationSeconds = opts.turnDurationSeconds ?? 60;
    this.timer = new TurnTimer({
      durationSeconds: this.turnDurationSeconds,
      onTick: (seconds) => this.broadcast({ type: 'timer_tick', secondsRemaining: seconds }),
      onExpire: () => this.endTurn(),
    });
  }

  handleConnection(ws: WebSocket): void {
    ws.on('message', (data) => {
      try {
        const msg: ClientMessage = JSON.parse(data.toString());
        this.handleMessage(ws, msg);
      } catch {
        this.send(ws, { type: 'error', message: 'Invalid message format' });
      }
    });

    ws.on('close', () => {
      // Remove spectator if applicable
      if (this.spectators.delete(ws)) {
        console.log('Spectator disconnected');
        return;
      }

      // Find and remove disconnected player
      for (const [playerId, conn] of this.connections) {
        if (conn.ws === ws) {
          this.connections.delete(playerId);
          this.broadcast({ type: 'player_left', playerId });
          console.log(`Player ${conn.name} (${playerId}) disconnected`);
          break;
        }
      }
    });
  }

  private handleMessage(ws: WebSocket, msg: ClientMessage): void {
    switch (msg.type) {
      case 'join':
        this.handleJoin(ws, msg.playerId, msg.name);
        break;
      case 'submit_actions':
        this.handleSubmitActions(msg.playerId, msg.actions);
        break;
      case 'start_game':
        this.handleStartGame(msg.playerId);
        break;
      case 'watch':
        this.handleWatch(ws);
        break;
    }
  }

  private handleJoin(ws: WebSocket, playerId: string, name: string): void {
    if (this.state?.phase === 'playing') {
      // Allow reconnection if player exists
      if (this.state.players.has(playerId)) {
        this.connections.set(playerId, { ws, playerId, name });
        this.send(ws, { type: 'game_state', state: serializeGameState(this.state) });
        console.log(`Player ${name} (${playerId}) reconnected`);
        return;
      }
      this.send(ws, { type: 'error', message: 'Game already in progress' });
      return;
    }

    if (this.connections.has(playerId)) {
      // Update connection
      this.connections.set(playerId, { ws, playerId, name });
      this.send(ws, { type: 'game_state', state: serializeGameState(this.state!) });
      return;
    }

    this.connections.set(playerId, { ws, playerId, name });

    // Initialize or update game state with new player
    this.rebuildGameState();

    const player = this.state!.players.get(playerId)!;
    this.broadcast({ type: 'player_joined', player });
    this.send(ws, { type: 'game_state', state: serializeGameState(this.state!) });

    console.log(`Player ${name} (${playerId}) joined. ${this.connections.size} players connected.`);
  }

  private handleSubmitActions(playerId: string, actions: PlayerAction[]): void {
    if (!this.state || this.state.phase !== 'playing') {
      const conn = this.connections.get(playerId);
      if (conn) {
        this.send(conn.ws, { type: 'error', message: 'Game is not in progress' });
      }
      return;
    }

    // Replace any previous actions for this player
    this.pendingActions.set(playerId, actions);
    console.log(`Player ${playerId} submitted ${actions.length} actions`);
  }

  private handleStartGame(playerId: string): void {
    if (this.state?.phase === 'playing') {
      const conn = this.connections.get(playerId);
      if (conn) {
        this.send(conn.ws, { type: 'error', message: 'Game already started' });
      }
      return;
    }

    if (this.connections.size < 2) {
      const conn = this.connections.get(playerId);
      if (conn) {
        this.send(conn.ws, { type: 'error', message: 'Need at least 2 players' });
      }
      return;
    }

    this.startGame();
  }

  private handleWatch(ws: WebSocket): void {
    this.spectators.add(ws);
    if (this.state) {
      this.send(ws, { type: 'game_state', state: serializeGameState(this.state) });
    }
    console.log(`Spectator connected. ${this.spectators.size} spectators.`);
  }

  private rebuildGameState(): void {
    const playerDefs = Array.from(this.connections.values()).map((c) => ({
      id: c.playerId,
      name: c.name,
    }));
    this.state = createGame(playerDefs);
  }

  private startGame(): void {
    if (!this.state) return;

    this.state = assignTerritories(this.state, Date.now());

    // Broadcast initial state
    const serialized = serializeGameState(this.state);
    this.broadcast({ type: 'game_state', state: serialized });

    // Start turn timer
    this.timer.start();
    console.log(`Game started with ${this.connections.size} players. Turn 1 begins.`);
  }

  private endTurn(): void {
    if (!this.state || this.state.phase !== 'playing') return;

    // Collect all pending actions
    const allActions: PlayerAction[] = [];
    for (const actions of this.pendingActions.values()) {
      allActions.push(...actions);
    }

    // Resolve turn
    const result = resolveTurn(this.state, allActions);
    this.state = result.state;
    this.pendingActions.clear();

    console.log(`Turn ${result.state.turnNumber - 1} resolved. ${result.events.length} events.`);

    if (this.state.phase === 'finished') {
      // Game over
      this.broadcast({
        type: 'turn_result',
        result: serializeTurnResult(result),
        nextTurnEndsAt: 0,
      });
      this.timer.stop();
      console.log('Game finished!');
      return;
    }

    // Start next turn
    this.timer.start();
    this.broadcast({
      type: 'turn_result',
      result: serializeTurnResult(result),
      nextTurnEndsAt: this.timer.getEndTime(),
    });
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
    for (const conn of this.connections.values()) {
      if (conn.ws.readyState === WebSocket.OPEN) {
        conn.ws.send(data);
      }
    }
    for (const ws of this.spectators) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }
}
