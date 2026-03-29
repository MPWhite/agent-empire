import type { TurnPhase, AttackAction, ReinforceAction } from 'engine';

// ── Agent (individual AI connecting to the game) ──

export interface Agent {
  id: string;          // Server-assigned: "agent-xxxx"
  name: string;        // Display name (default = id, customizable)
  teamId: string;      // Which empire/player this agent belongs to
  apiKey: string;      // Auth token for API requests
  joinedAt: number;    // Timestamp
}

// ── Proposal (an action plan submitted by an agent for team voting) ──

export interface ProposalReinforce {
  territoryId: string;
  troops: number;
}

export interface ProposalAttack {
  from: string;
  to: string;
  troops: number;
}

export interface Proposal {
  id: string;          // Server-assigned: "prop-xxxx"
  teamId: string;
  agentId: string;     // Who submitted it
  name: string;        // Human-readable name (max 80 chars)
  reinforce: ProposalReinforce[];
  attack: ProposalAttack[];
  submittedAt: number;
  votes: number;       // Live vote count
}

// ── Vote ──

export interface Vote {
  agentId: string;
  proposalId: string;
  votedAt: number;
}

// ── Chat ──

export interface ChatMessage {
  id: string;
  teamId: string;
  agentId: string;     // "system" for system messages
  agentName: string;
  text: string;
  timestamp: number;
}

// ── Team State (server-side coordination state per empire) ──

export interface TeamState {
  teamId: string;      // Maps to engine's Player.id (e.g., "p1")
  agents: Map<string, Agent>;
  chat: ChatMessage[];
  proposals: Map<string, Proposal>;
  votes: Map<string, Vote>;  // agentId → Vote (one vote per agent)
}

// ── Phase Speed ──
// PHASE_SPEED env var: divides all durations. 1=normal, 10=10x faster, 60=60x faster
export const PHASE_SPEED = Math.max(1, parseInt(process.env.PHASE_SPEED ?? '1', 10));

// ── Phase Timing ──

export interface PhaseConfig {
  phase: TurnPhase;
  durationMs: number;
}

const BASE_PHASES: PhaseConfig[] = [
  { phase: 'observe',  durationMs: 60_000 },    // 1 minute
  { phase: 'discuss',  durationMs: 480_000 },   // 8 minutes
  { phase: 'propose',  durationMs: 180_000 },   // 3 minutes
  { phase: 'vote',     durationMs: 120_000 },   // 2 minutes
  { phase: 'resolve',  durationMs: 60_000 },    // 1 minute
];

export const TURN_PHASES: PhaseConfig[] = BASE_PHASES.map((p) => ({
  phase: p.phase,
  durationMs: Math.max(1000, Math.round(p.durationMs / PHASE_SPEED)),
}));

export const TOTAL_TURN_MS = TURN_PHASES.reduce((sum, p) => sum + p.durationMs, 0);

// ── Rate Limits ──

const BASE_RATE_LIMITS: Record<TurnPhase, number> = {
  observe: 20_000,
  discuss: 20_000,
  propose: 45_000,
  vote:    45_000,
  resolve: 45_000,
};

export const CHAT_RATE_LIMITS: Record<TurnPhase, number> = Object.fromEntries(
  Object.entries(BASE_RATE_LIMITS).map(([phase, ms]) => [
    phase,
    Math.max(200, Math.round(ms / PHASE_SPEED)),
  ])
) as Record<TurnPhase, number>;

export const MAX_CHAT_LENGTH = 500;
export const MAX_PROPOSALS_PER_TEAM = 20;
export const MAX_AGENT_NAME_LENGTH = 20;

// ── API Responses ──

export interface JoinResponse {
  agentId: string;
  teamId: string;
  apiKey: string;
  teamName: string;
  teamColor: string;
}

export interface ApiError {
  error: string;
  code: string;
}
