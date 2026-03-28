import crypto from 'node:crypto';
import type { PlayerAction, AttackAction, ReinforceAction } from 'engine';
import type { Proposal, ProposalReinforce, ProposalAttack, Vote } from './types.js';
import { MAX_PROPOSALS_PER_TEAM } from './types.js';
import type { AgentManager } from './agents.js';

export class VotingManager {
  private agentManager: AgentManager;

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
  }

  submitProposal(
    teamId: string,
    agentId: string,
    name: string,
    reinforce: ProposalReinforce[],
    attack: ProposalAttack[],
  ): Proposal {
    const teamState = this.agentManager.getTeamState(teamId);
    if (!teamState) throw new Error('Team not found');

    if (teamState.proposals.size >= MAX_PROPOSALS_PER_TEAM) {
      throw new Error(`Maximum ${MAX_PROPOSALS_PER_TEAM} proposals per team per turn`);
    }

    if (!name || typeof name !== 'string') {
      throw new Error('Proposal name is required');
    }

    const trimmedName = name.slice(0, 80);

    const proposal: Proposal = {
      id: `prop-${crypto.randomBytes(4).toString('hex')}`,
      teamId,
      agentId,
      name: trimmedName,
      reinforce: reinforce ?? [],
      attack: attack ?? [],
      submittedAt: Date.now(),
      votes: 0,
    };

    teamState.proposals.set(proposal.id, proposal);
    return proposal;
  }

  castVote(teamId: string, agentId: string, proposalId: string): void {
    const teamState = this.agentManager.getTeamState(teamId);
    if (!teamState) throw new Error('Team not found');

    if (!teamState.proposals.has(proposalId)) {
      throw new Error('Proposal not found');
    }

    // Check if already voted
    const existingVote = teamState.votes.get(agentId);
    if (existingVote) {
      throw new Error('Already voted this turn');
    }

    const vote: Vote = {
      agentId,
      proposalId,
      votedAt: Date.now(),
    };

    teamState.votes.set(agentId, vote);

    // Update vote count on the proposal
    const proposal = teamState.proposals.get(proposalId)!;
    proposal.votes++;
  }

  getProposals(teamId: string): Proposal[] {
    const teamState = this.agentManager.getTeamState(teamId);
    if (!teamState) return [];
    return Array.from(teamState.proposals.values()).sort((a, b) => a.submittedAt - b.submittedAt);
  }

  getTotalVotes(teamId: string): number {
    const teamState = this.agentManager.getTeamState(teamId);
    if (!teamState) return 0;
    return teamState.votes.size;
  }

  /**
   * Resolve voting for a team: return the winning proposal's actions
   * converted to engine PlayerAction format.
   * Plurality wins. Tiebreaker: earliest submission.
   * Returns null if no proposals or no votes.
   */
  resolveVotes(teamId: string): PlayerAction[] | null {
    const teamState = this.agentManager.getTeamState(teamId);
    if (!teamState) return null;

    const proposals = Array.from(teamState.proposals.values());
    if (proposals.length === 0) return null;

    // Find the winning proposal: most votes, tiebreak by earliest submission
    let winner: Proposal | null = null;
    for (const proposal of proposals) {
      if (!winner || proposal.votes > winner.votes ||
          (proposal.votes === winner.votes && proposal.submittedAt < winner.submittedAt)) {
        winner = proposal;
      }
    }

    if (!winner || winner.votes === 0) {
      // No votes cast — use the first proposal submitted as fallback
      winner = proposals.sort((a, b) => a.submittedAt - b.submittedAt)[0];
    }

    return this.proposalToActions(teamId, winner);
  }

  /**
   * Convert a Proposal to an array of PlayerActions for the engine.
   */
  private proposalToActions(teamId: string, proposal: Proposal): PlayerAction[] {
    const actions: PlayerAction[] = [];

    for (const r of proposal.reinforce) {
      actions.push({
        type: 'reinforce',
        playerId: teamId,
        territoryId: r.territoryId,
        troops: r.troops,
      } satisfies ReinforceAction);
    }

    for (const a of proposal.attack) {
      actions.push({
        type: 'attack',
        playerId: teamId,
        fromTerritoryId: a.from,
        toTerritoryId: a.to,
        troops: a.troops,
      } satisfies AttackAction);
    }

    return actions;
  }

  /**
   * Get the winning proposal for display purposes.
   */
  getWinner(teamId: string): Proposal | null {
    const teamState = this.agentManager.getTeamState(teamId);
    if (!teamState) return null;

    const proposals = Array.from(teamState.proposals.values());
    if (proposals.length === 0) return null;

    let winner: Proposal | null = null;
    for (const proposal of proposals) {
      if (!winner || proposal.votes > winner.votes ||
          (proposal.votes === winner.votes && proposal.submittedAt < winner.submittedAt)) {
        winner = proposal;
      }
    }

    return winner;
  }
}
