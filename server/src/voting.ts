import crypto from 'node:crypto';
import type {
  PlayerAction,
  AttackAction,
  ReinforceAction,
  ResearchAction,
  BuildFortAction,
  LaunchMissileAction,
  LaunchNukeAction,
  TradeAction,
  SanctionAction,
  SpyAction,
  CyberattackAction,
  DiplomacyAction,
} from 'engine';
import type {
  Proposal,
  ProposalReinforce,
  ProposalAttack,
  ProposalResearch,
  ProposalBuildFort,
  ProposalMissile,
  ProposalNuke,
  ProposalTrade,
  ProposalSanction,
  ProposalSpy,
  ProposalCyberattack,
  ProposalDiplomacy,
  Vote,
} from './types.js';
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
    research?: ProposalResearch,
    buildFort?: ProposalBuildFort[],
    launchMissile?: ProposalMissile[],
    launchNuke?: ProposalNuke[],
    trade?: ProposalTrade[],
    sanction?: ProposalSanction[],
    spy?: ProposalSpy[],
    cyberattack?: ProposalCyberattack[],
    diplomacy?: ProposalDiplomacy[],
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
      research: research,
      buildFort: buildFort ?? [],
      launchMissile: launchMissile ?? [],
      launchNuke: launchNuke ?? [],
      trade: trade ?? [],
      sanction: sanction ?? [],
      spy: spy ?? [],
      cyberattack: cyberattack ?? [],
      diplomacy: diplomacy ?? [],
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
   */
  resolveVotes(teamId: string): PlayerAction[] | null {
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

    if (!winner || winner.votes === 0) {
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

    if (proposal.research) {
      actions.push({
        type: 'research',
        playerId: teamId,
        branch: proposal.research.branch,
        investment: proposal.research.investment,
      } satisfies ResearchAction);
    }

    for (const f of proposal.buildFort) {
      actions.push({
        type: 'buildFort',
        playerId: teamId,
        territoryId: f.territoryId,
      } satisfies BuildFortAction);
    }

    for (const m of proposal.launchMissile) {
      actions.push({
        type: 'launchMissile',
        playerId: teamId,
        targetTerritoryId: m.target,
      } satisfies LaunchMissileAction);
    }

    for (const n of proposal.launchNuke) {
      actions.push({
        type: 'launchNuke',
        playerId: teamId,
        targetTerritoryId: n.target,
      } satisfies LaunchNukeAction);
    }

    for (const t of proposal.trade) {
      actions.push({
        type: 'trade',
        playerId: teamId,
        targetPlayerId: t.targetEmpire,
        offer: t.offer,
        request: t.request,
      } satisfies TradeAction);
    }

    for (const s of proposal.sanction) {
      actions.push({
        type: 'sanction',
        playerId: teamId,
        targetPlayerId: s.targetEmpire,
      } satisfies SanctionAction);
    }

    for (const sp of proposal.spy) {
      actions.push({
        type: 'spy',
        playerId: teamId,
        targetPlayerId: sp.targetEmpire,
        operation: sp.operation,
      } satisfies SpyAction);
    }

    for (const c of proposal.cyberattack) {
      actions.push({
        type: 'cyberattack',
        playerId: teamId,
        targetPlayerId: c.targetEmpire,
        target: c.target,
        territoryOrBranch: c.territoryOrBranch,
      } satisfies CyberattackAction);
    }

    for (const d of proposal.diplomacy) {
      actions.push({
        type: 'diplomacy',
        playerId: teamId,
        diplomacyType: d.type,
        targetPlayerId: d.targetEmpire,
        messageText: d.messageText,
        treatyType: d.treatyType,
        treatyDuration: d.treatyDuration,
        tradeOffer: d.tradeOffer,
        tradeRequest: d.tradeRequest,
        agreementId: d.agreementId,
        resolutionId: d.resolutionId,
        vote: d.vote,
        resolutionType: d.resolutionType,
        resolutionDetails: d.resolutionDetails,
      } satisfies DiplomacyAction);
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
