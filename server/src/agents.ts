import crypto from 'node:crypto';
import type { Agent, TeamState, JoinResponse } from './types.js';
import type { Player } from 'engine';

/**
 * Manages agents, teams, and their coordination state.
 * This is the bridge between external AI agents (HTTP API) and
 * the engine's player/team model.
 */
export class AgentManager {
  /** agentId → Agent */
  private agents = new Map<string, Agent>();
  /** apiKey → agentId (for auth lookups) */
  private apiKeyIndex = new Map<string, string>();
  /** teamId → TeamState */
  private teams = new Map<string, TeamState>();
  /** display names in use (lowercase for uniqueness) */
  private usedNames = new Set<string>();

  /**
   * Initialize team states from the engine's player map.
   */
  initTeams(players: Map<string, Player>): void {
    for (const [playerId] of players) {
      if (!this.teams.has(playerId)) {
        this.teams.set(playerId, {
          teamId: playerId,
          agents: new Map(),
          chat: [],
          proposals: new Map(),
          votes: new Map(),
        });
      }
    }
  }

  /**
   * Register a new agent and assign to the team with fewest agents.
   */
  joinAgent(players: Map<string, Player>): JoinResponse {
    // Find the alive team with the fewest agents
    let bestTeamId: string | null = null;
    let bestCount = Infinity;

    for (const [playerId, player] of players) {
      if (!player.isAlive) continue;
      const teamState = this.teams.get(playerId);
      const count = teamState?.agents.size ?? 0;
      if (count < bestCount) {
        bestCount = count;
        bestTeamId = playerId;
      }
    }

    if (!bestTeamId) {
      throw new Error('No alive teams to join');
    }

    const agentId = `agent-${crypto.randomBytes(4).toString('hex')}`;
    const apiKey = `ak-${crypto.randomBytes(16).toString('hex')}`;
    const player = players.get(bestTeamId)!;

    const agent: Agent = {
      id: agentId,
      name: agentId,
      teamId: bestTeamId,
      apiKey,
      joinedAt: Date.now(),
    };

    this.agents.set(agentId, agent);
    this.apiKeyIndex.set(apiKey, agentId);
    this.teams.get(bestTeamId)!.agents.set(agentId, agent);

    return {
      agentId,
      teamId: bestTeamId,
      apiKey,
      teamName: player.name,
      teamColor: player.color,
    };
  }

  /**
   * Authenticate an API key and return the agent, or null if invalid.
   */
  authenticateAgent(apiKey: string): Agent | null {
    const agentId = this.apiKeyIndex.get(apiKey);
    if (!agentId) return null;
    return this.agents.get(agentId) ?? null;
  }

  /**
   * Update agent display name.
   */
  setAgentName(agentId: string, name: string): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) return false;

    const lower = name.toLowerCase();
    if (this.usedNames.has(lower) && agent.name.toLowerCase() !== lower) {
      return false; // Name already taken
    }

    // Release old name
    this.usedNames.delete(agent.name.toLowerCase());
    agent.name = name;
    this.usedNames.add(lower);
    return true;
  }

  getAgent(agentId: string): Agent | null {
    return this.agents.get(agentId) ?? null;
  }

  getTeamState(teamId: string): TeamState | null {
    return this.teams.get(teamId) ?? null;
  }

  getAllTeamStates(): Map<string, TeamState> {
    return this.teams;
  }

  getAgentCount(): number {
    return this.agents.size;
  }

  getTeamAgentCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [teamId, state] of this.teams) {
      counts[teamId] = state.agents.size;
    }
    return counts;
  }

  /**
   * Check whether any alive team has at least one agent.
   */
  hasAliveTeamWithAgents(players: Map<string, Player>): boolean {
    for (const [playerId, player] of players) {
      if (!player.isAlive) continue;
      const teamState = this.teams.get(playerId);
      if (teamState && teamState.agents.size > 0) return true;
    }
    return false;
  }

  /**
   * Clear proposals and votes for a new turn. Keeps chat history.
   */
  resetTurnState(): void {
    for (const team of this.teams.values()) {
      team.proposals.clear();
      team.votes.clear();
    }
  }
}
