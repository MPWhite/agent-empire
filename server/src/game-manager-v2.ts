import { WebSocket } from 'ws';
import {
  createGame,
  assignTerritories,
  resolveTurn,
  type GameState,
  type Player,
  type PlayerAction,
  type TurnPhase,
} from 'engine';
import { AgentManager } from './agents.js';
import { ChatManager } from './chat.js';
import { VotingManager } from './voting.js';
import { saveGame, loadGame } from './persistence.js';
import {
  createHistory,
  appendTurn,
  addMajorEvent,
  detectMajorEvents,
  saveHistory,
  loadHistory,
  type GameHistory,
} from './history.js';
import { generateEventSummary } from './history-summaries.js';
import {
  serializeGameState,
  serializeTurnResult,
  type ServerMessage,
} from './protocol.js';
import { TURN_PHASES, type PhaseConfig, type ChatMessage, type Proposal } from './types.js';

const EMPIRES = [
  { id: 'p1', name: 'Crimson Empire' },
  { id: 'p2', name: 'Azure Dominion' },
  { id: 'p3', name: 'Emerald Accord' },
  { id: 'p4', name: 'Golden Horde' },
];

export class GameManagerV2 {
  private state: GameState;
  private history: GameHistory;
  private spectators = new Set<WebSocket>();

  // Coordination layer
  readonly agentManager: AgentManager;
  readonly chatManager: ChatManager;
  readonly votingManager: VotingManager;

  // Phase management
  private currentPhaseIndex = 0;
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private phaseStartedAt: number = 0;
  private turnActive = false;

  constructor() {
    this.agentManager = new AgentManager();
    this.chatManager = new ChatManager(this.agentManager);
    this.votingManager = new VotingManager(this.agentManager);

    const loaded = loadGame();
    if (loaded) {
      this.state = loaded;
      this.history = loadHistory() ?? createHistory(loaded);
      console.log(`Loaded saved game — turn ${loaded.turnNumber}, phase: ${loaded.phase}`);
    } else {
      this.state = this.createFreshGame();
      this.history = createHistory(this.state);
      saveHistory(this.history);
      console.log('Created new game with 4 empires');
    }

    this.agentManager.initTeams(this.state.players);
  }

  private createFreshGame(): GameState {
    const state = createGame(EMPIRES);
    const started = assignTerritories(state);
    saveGame(started);
    return started;
  }

  // ── Phase Management ──

  /**
   * Start the turn cycle. Called when enough agents have joined.
   */
  startTurnCycle(): void {
    if (this.turnActive) return;
    if (this.state.phase === 'finished') return;

    // Ensure game is in playing state
    if (this.state.phase === 'waiting') {
      this.state.phase = 'playing';
      saveGame(this.state);
    }

    this.turnActive = true;
    this.beginTurn();
  }

  private beginTurn(): void {
    if (this.state.phase === 'finished') {
      this.turnActive = false;
      return;
    }

    // Reset per-turn state
    this.agentManager.resetTurnState();
    this.currentPhaseIndex = 0;

    console.log(`\n═══ Turn ${this.state.turnNumber} ═══`);

    // Broadcast turn start to all team chats
    for (const [teamId] of this.agentManager.getAllTeamStates()) {
      this.chatManager.addSystemMessage(teamId, `── Turn ${this.state.turnNumber} begins ──`);
    }

    // Broadcast state to spectators
    this.broadcast({
      type: 'game_state',
      state: serializeGameState(this.state),
    });

    this.startPhase();
  }

  private startPhase(): void {
    const phaseConfig = TURN_PHASES[this.currentPhaseIndex];
    this.phaseStartedAt = Date.now();

    console.log(`  Phase: ${phaseConfig.phase} (${phaseConfig.durationMs / 1000}s)`);

    // Broadcast phase change
    this.broadcastPhaseChange(phaseConfig.phase);

    // System messages for key phase transitions
    if (phaseConfig.phase === 'propose') {
      for (const [teamId] of this.agentManager.getAllTeamStates()) {
        this.chatManager.addSystemMessage(teamId, 'Proposal phase: submit your action plans now.');
      }
    } else if (phaseConfig.phase === 'vote') {
      for (const [teamId] of this.agentManager.getAllTeamStates()) {
        const proposals = this.votingManager.getProposals(teamId);
        this.chatManager.addSystemMessage(
          teamId,
          `Voting phase: ${proposals.length} proposal(s) submitted. Cast your vote.`,
        );
      }
    }

    // Schedule next phase
    this.phaseTimer = setTimeout(() => this.advancePhase(), phaseConfig.durationMs);
  }

  private advancePhase(): void {
    this.currentPhaseIndex++;

    if (this.currentPhaseIndex >= TURN_PHASES.length) {
      // All phases done — resolve the turn
      this.resolveTurn();
      return;
    }

    this.startPhase();
  }

  private resolveTurn(): void {
    console.log(`  Resolving turn ${this.state.turnNumber}...`);

    // Collect winning proposals from each alive team
    const allActions: PlayerAction[] = [];
    for (const [teamId, player] of this.state.players) {
      if (!player.isAlive) continue;

      const actions = this.votingManager.resolveVotes(teamId);
      if (actions) {
        allActions.push(...actions);
      }

      // Announce the winner in team chat
      const winner = this.votingManager.getWinner(teamId);
      if (winner) {
        this.chatManager.addSystemMessage(
          teamId,
          `Vote result: "${winner.name}" wins with ${winner.votes} vote(s).`,
        );
      } else {
        this.chatManager.addSystemMessage(
          teamId,
          'No proposals submitted. Reinforcements distributed automatically.',
        );
      }
    }

    // Run engine resolution
    const previousState = this.state;
    const result = resolveTurn(this.state, allActions);
    this.state = result.state;
    saveGame(this.state);

    // History
    appendTurn(this.history, this.state);
    const majorEvents = detectMajorEvents(previousState, this.state, result.events);
    for (const event of majorEvents) {
      addMajorEvent(this.history, event);
      generateEventSummary(event, this.history).then((summary) => {
        if (summary) {
          event.summary = summary;
          saveHistory(this.history);
        }
      });
    }
    saveHistory(this.history);

    // Broadcast results
    this.broadcast({
      type: 'turn_result',
      result: serializeTurnResult(result),
    });

    const eventCount = result.events.length;
    const majorCount = majorEvents.length;
    console.log(`  Turn ${result.state.turnNumber - 1} resolved. ${eventCount} events.${majorCount > 0 ? ` ${majorCount} major.` : ''}`);

    if (this.state.phase === 'finished') {
      this.turnActive = false;
      console.log('Game finished!');
      return;
    }

    // Start next turn
    this.beginTurn();
  }

  // ── Public API ──

  getCurrentPhase(): TurnPhase {
    return TURN_PHASES[this.currentPhaseIndex]?.phase ?? 'observe';
  }

  getPhaseEndsAt(): number {
    const phaseConfig = TURN_PHASES[this.currentPhaseIndex];
    if (!phaseConfig) return 0;
    return this.phaseStartedAt + phaseConfig.durationMs;
  }

  getPublicState(): any {
    return {
      ...serializeGameState(this.state),
      turnPhase: this.getCurrentPhase(),
      phaseEndsAt: new Date(this.getPhaseEndsAt()).toISOString(),
      agentCounts: this.agentManager.getTeamAgentCounts(),
      totalAgents: this.agentManager.getAgentCount(),
    };
  }

  getPlayers(): Map<string, Player> {
    return this.state.players;
  }

  isRunning(): boolean {
    return this.turnActive;
  }

  // ── WebSocket (spectators) ──

  handleSpectatorConnection(ws: WebSocket): void {
    this.spectators.add(ws);
    this.send(ws, { type: 'game_state', state: serializeGameState(this.state) });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleSpectatorMessage(ws, msg);
      } catch {
        this.send(ws, { type: 'error', message: 'Invalid message format' });
      }
    });

    ws.on('close', () => {
      this.spectators.delete(ws);
    });
  }

  private handleSpectatorMessage(ws: WebSocket, msg: any): void {
    switch (msg.type) {
      case 'new_game':
        this.handleNewGame();
        break;
      case 'request_history':
        this.send(ws, {
          type: 'history_meta',
          totalTurns: this.history.turns.length,
          majorEvents: this.history.majorEvents,
          playerNames: this.history.playerNames,
        });
        break;
      case 'request_turn':
        const snapshot = this.history.turns.find((t) => t.turnNumber === msg.turnNumber);
        if (snapshot) {
          this.send(ws, { type: 'turn_snapshot', turnNumber: msg.turnNumber, snapshot });
        }
        break;
    }
  }

  private handleNewGame(): void {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.turnActive = false;
    this.state = this.createFreshGame();
    this.agentManager.initTeams(this.state.players);
    this.history = createHistory(this.state);
    saveHistory(this.history);
    this.broadcast({ type: 'game_state', state: serializeGameState(this.state) });
    console.log('New game created');
  }

  // ── Broadcast Helpers ──

  broadcastChatMessage(message: ChatMessage): void {
    this.broadcast({
      type: 'chat_message' as any,
      message,
    } as any);
  }

  broadcastProposalUpdate(teamId: string): void {
    const proposals = this.votingManager.getProposals(teamId);
    this.broadcast({
      type: 'proposal_update' as any,
      teamId,
      proposals,
    } as any);
  }

  broadcastVoteUpdate(teamId: string): void {
    const proposals = this.votingManager.getProposals(teamId);
    this.broadcast({
      type: 'vote_update' as any,
      teamId,
      proposals,
      totalVotes: this.votingManager.getTotalVotes(teamId),
    } as any);
  }

  private broadcastPhaseChange(phase: TurnPhase): void {
    this.broadcast({
      type: 'phase_change' as any,
      phase,
      phaseEndsAt: new Date(this.getPhaseEndsAt()).toISOString(),
      turnNumber: this.state.turnNumber,
    } as any);
  }

  private send(ws: WebSocket, msg: ServerMessage | any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: ServerMessage | any): void {
    const data = JSON.stringify(msg);
    for (const ws of this.spectators) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }
}
