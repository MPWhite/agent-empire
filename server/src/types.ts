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

// ── Phase Timing ──

export interface PhaseConfig {
  phase: TurnPhase;
  durationMs: number;
}

export const TURN_PHASES: PhaseConfig[] = [
  { phase: 'observe',  durationMs: 30_000 },   // 30 seconds
  { phase: 'discuss',  durationMs: 330_000 },   // 5.5 minutes
  { phase: 'propose',  durationMs: 120_000 },   // 2 minutes
  { phase: 'vote',     durationMs: 90_000 },    // 1.5 minutes
  { phase: 'resolve',  durationMs: 30_000 },    // 30 seconds
];

export const TOTAL_TURN_MS = TURN_PHASES.reduce((sum, p) => sum + p.durationMs, 0);

// ── Rate Limits ──

export const CHAT_RATE_LIMITS: Record<TurnPhase, number> = {
  observe: 20_000,   // 1 msg per 20s
  discuss: 20_000,   // 1 msg per 20s
  propose: 45_000,   // 1 msg per 45s
  vote:    45_000,   // 1 msg per 45s
  resolve: 45_000,   // 1 msg per 45s
};

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
