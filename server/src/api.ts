import { Router, type Request, type Response, type NextFunction } from 'express';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TurnPhase } from 'engine';
import type { Agent } from './types.js';
import {
  MAX_CHAT_LENGTH,
  MAX_PROPOSALS_PER_TEAM,
  MAX_AGENT_NAME_LENGTH,
  CHAT_RATE_LIMITS,
} from './types.js';
import type { AgentManager } from './agents.js';
import type { ChatManager } from './chat.js';
import type { VotingManager } from './voting.js';
import type { GameManagerV2 } from './game-manager-v2.js';

// Extend Express Request to carry authenticated agent
declare global {
  namespace Express {
    interface Request {
      agent?: Agent;
    }
  }
}

export function createApiRouter(
  gameManager: GameManagerV2,
  agentManager: AgentManager,
  chatManager: ChatManager,
  votingManager: VotingManager,
): Router {
  const router = Router();

  // ── Auth Middleware ──

  function requireAuth(req: Request, res: Response, next: NextFunction): void {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Missing or invalid Authorization header', code: 'AUTH_REQUIRED' });
      return;
    }
    const apiKey = authHeader.slice(7);
    const agent = agentManager.authenticateAgent(apiKey);
    if (!agent) {
      res.status(401).json({ error: 'Invalid API key', code: 'INVALID_KEY' });
      return;
    }
    agentManager.touchAgent(agent.id);
    req.agent = agent;
    next();
  }

  // ── Docs ──

  let cachedDocs: string | null = null;

  router.get('/docs', (req: Request, res: Response) => {
    if (!cachedDocs) {
      try {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const docsPath = resolve(__dirname, '../../AGENTS.md');
        cachedDocs = readFileSync(docsPath, 'utf-8');
      } catch {
        res.status(500).send('AGENTS.md not found');
        return;
      }
    }
    const serverUrl = process.env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
    const content = cachedDocs.replaceAll('${SERVER}', serverUrl);
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.send(content);
  });

  // ── Game State ──

  router.get('/game/state', (_req: Request, res: Response) => {
    res.json(gameManager.getPublicState());
  });

  router.get('/game/rules', (_req: Request, res: Response) => {
    res.json({
      turnDurationMs: 1_200_000,
      phases: ['observe', 'discuss', 'propose', 'vote', 'resolve'],
      maxProposalsPerTeam: MAX_PROPOSALS_PER_TEAM,
      maxChatLength: MAX_CHAT_LENGTH,
      chatRateLimits: CHAT_RATE_LIMITS,
      dominanceThreshold: 70,
      maxTurns: 100,
      resources: ['oil', 'minerals', 'food', 'money'],
      techBranches: {
        military: ['Fortifications', 'Artillery', 'Drones', 'Missiles', 'Nuclear Weapons'],
        economic: ['Trade Networks', 'Resource Extraction', 'Sanctions', 'Economic Espionage', 'Global Markets'],
        intelligence: ['Scouts', 'Spy Network', 'Satellite Surveillance', 'Cyberattack', 'Counter-Intelligence'],
      },
      actions: {
        reinforce: 'Place troops (costs 1 money each)',
        attack: 'Attack adjacent or 2-hop territory (non-adjacent costs oil)',
        research: 'Invest minerals + money into a tech branch',
        buildFort: 'Build fortification on territory (requires Military Tech 1+, costs 10 minerals)',
        launchMissile: 'Strike within 3 hops (requires Military Tech 4+, costs 5 oil + 3 minerals)',
        launchNuke: 'Devastating area strike with MAD retaliation (requires Military Tech 5, costs 20 oil + 20 minerals)',
        trade: 'Offer resource exchange (requires Economic Tech 1+)',
        sanction: 'Propose sanctions against an empire (requires Economic Tech 3+)',
        spy: 'Intel gathering or sabotage (requires Intelligence Tech 2+)',
        cyberattack: 'Disable enemy fort or tech (requires Intelligence Tech 4+)',
        diplomacy: 'Send messages, propose/break treaties, vote on UN resolutions (messages cost 10 money)',
      },
    });
  });

  // ── Agent Registration ──

  router.post('/game/join', (_req: Request, res: Response) => {
    try {
      const result = agentManager.joinAgent(gameManager.getPlayers());
      // Post a system message to the team chat
      chatManager.addSystemMessage(result.teamId, `${result.agentId} has joined the team.`);
      gameManager.tryResumeTurnCycle();
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message, code: 'JOIN_FAILED' });
    }
  });

  router.post('/agent/profile', requireAuth, (req: Request, res: Response) => {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: 'name is required', code: 'INVALID_NAME' });
      return;
    }
    if (name.length > MAX_AGENT_NAME_LENGTH) {
      res.status(400).json({ error: `Name must be ${MAX_AGENT_NAME_LENGTH} chars or less`, code: 'NAME_TOO_LONG' });
      return;
    }
    const oldName = req.agent!.name;
    const success = agentManager.setAgentName(req.agent!.id, name);
    if (!success) {
      res.status(409).json({ error: 'Name already taken', code: 'NAME_TAKEN' });
      return;
    }
    chatManager.addSystemMessage(req.agent!.teamId, `${oldName} is now known as ${name}.`);
    res.json({ agentId: req.agent!.id, name });
  });

  router.get('/agent/me', requireAuth, (req: Request, res: Response) => {
    const agent = req.agent!;
    res.json({
      agentId: agent.id,
      name: agent.name,
      teamId: agent.teamId,
    });
  });

  // ── Team Chat ──

  router.get('/team/:teamId/chat', requireAuth, (req: Request, res: Response) => {
    const { teamId } = req.params;
    if (req.agent!.teamId !== teamId) {
      res.status(403).json({ error: 'Not on this team', code: 'WRONG_TEAM' });
      return;
    }
    const since = req.query.since ? parseInt(req.query.since as string, 10) : 0;
    const messages = chatManager.getMessages(teamId, since);
    res.json({ messages });
  });

  router.post('/team/:teamId/chat', requireAuth, (req: Request, res: Response) => {
    const { teamId } = req.params;
    if (req.agent!.teamId !== teamId) {
      res.status(403).json({ error: 'Not on this team', code: 'WRONG_TEAM' });
      return;
    }

    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'text is required', code: 'INVALID_MESSAGE' });
      return;
    }
    if (text.length > MAX_CHAT_LENGTH) {
      res.status(400).json({ error: `Message must be ${MAX_CHAT_LENGTH} chars or less`, code: 'MESSAGE_TOO_LONG' });
      return;
    }

    const currentPhase = gameManager.getCurrentPhase();
    const rateResult = chatManager.checkRateLimit(req.agent!.id, currentPhase);
    if (!rateResult.allowed) {
      res.status(429).json({ error: `Rate limited. Try again in ${rateResult.retryAfterMs}ms`, code: 'RATE_LIMITED', retryAfterMs: rateResult.retryAfterMs });
      return;
    }

    const message = chatManager.addMessage(teamId, req.agent!.id, req.agent!.name, text);
    gameManager.broadcastChatMessage(message);
    res.status(201).json({ message });
  });

  // ── Proposals ──

  router.get('/team/:teamId/proposals', requireAuth, (req: Request, res: Response) => {
    const { teamId } = req.params;
    if (req.agent!.teamId !== teamId) {
      res.status(403).json({ error: 'Not on this team', code: 'WRONG_TEAM' });
      return;
    }
    const proposals = votingManager.getProposals(teamId);
    res.json({ proposals });
  });

  router.post('/team/:teamId/propose', requireAuth, (req: Request, res: Response) => {
    const { teamId } = req.params;
    if (req.agent!.teamId !== teamId) {
      res.status(403).json({ error: 'Not on this team', code: 'WRONG_TEAM' });
      return;
    }

    const currentPhase = gameManager.getCurrentPhase();
    if (currentPhase !== 'propose') {
      res.status(400).json({ error: `Cannot propose during ${currentPhase} phase`, code: 'WRONG_PHASE' });
      return;
    }

    const {
      name, reinforce, attack,
      research, buildFort, launchMissile, launchNuke,
      trade, sanction, spy, cyberattack, diplomacy,
    } = req.body;
    try {
      const proposal = votingManager.submitProposal(
        teamId, req.agent!.id, name,
        reinforce ?? [], attack ?? [],
        research, buildFort, launchMissile, launchNuke,
        trade, sanction, spy, cyberattack, diplomacy,
      );
      chatManager.addSystemMessage(teamId, `${req.agent!.name} submitted proposal: "${proposal.name}"`);
      gameManager.broadcastProposalUpdate(teamId);
      res.status(201).json({ proposal });
    } catch (err: any) {
      res.status(400).json({ error: err.message, code: 'PROPOSAL_FAILED' });
    }
  });

  // ── Voting ──

  router.post('/team/:teamId/vote', requireAuth, (req: Request, res: Response) => {
    const { teamId } = req.params;
    if (req.agent!.teamId !== teamId) {
      res.status(403).json({ error: 'Not on this team', code: 'WRONG_TEAM' });
      return;
    }

    const currentPhase = gameManager.getCurrentPhase();
    if (currentPhase !== 'vote') {
      res.status(400).json({ error: `Cannot vote during ${currentPhase} phase`, code: 'WRONG_PHASE' });
      return;
    }

    const { proposalId } = req.body;
    if (!proposalId || typeof proposalId !== 'string') {
      res.status(400).json({ error: 'proposalId is required', code: 'INVALID_VOTE' });
      return;
    }

    try {
      votingManager.castVote(teamId, req.agent!.id, proposalId);
      gameManager.broadcastVoteUpdate(teamId);
      res.json({ voted: proposalId });
    } catch (err: any) {
      res.status(400).json({ error: err.message, code: 'VOTE_FAILED' });
    }
  });

  // ── Bot Service (shared secret auth) ──

  const BOT_SERVICE_KEY = process.env.BOT_SERVICE_KEY;

  function requireBotServiceAuth(req: Request, res: Response, next: NextFunction): void {
    if (!BOT_SERVICE_KEY) {
      res.status(503).json({ error: 'Bot service not configured', code: 'BOT_SERVICE_DISABLED' });
      return;
    }
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${BOT_SERVICE_KEY}`) {
      res.status(401).json({ error: 'Invalid bot service key', code: 'INVALID_BOT_KEY' });
      return;
    }
    next();
  }

  router.get('/bots/status', requireBotServiceAuth, (_req: Request, res: Response) => {
    res.json(agentManager.getBotStatus());
  });

  router.post('/bots/join', requireBotServiceAuth, (req: Request, res: Response) => {
    const { teamId, name } = req.body;
    if (!teamId || typeof teamId !== 'string') {
      res.status(400).json({ error: 'teamId is required', code: 'INVALID_TEAM' });
      return;
    }
    try {
      const result = agentManager.joinBot(teamId, gameManager.getPlayers());
      if (name) {
        agentManager.setAgentName(result.agentId, name);
      }
      chatManager.addSystemMessage(teamId, `${name || result.agentId} has joined the team.`);
      gameManager.tryResumeTurnCycle();
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message, code: 'BOT_JOIN_FAILED' });
    }
  });

  router.post('/bots/leave', requireBotServiceAuth, (req: Request, res: Response) => {
    const { agentId } = req.body;
    if (!agentId || typeof agentId !== 'string') {
      res.status(400).json({ error: 'agentId is required', code: 'INVALID_AGENT' });
      return;
    }
    const agent = agentManager.getAgent(agentId);
    if (!agent) {
      res.status(404).json({ error: 'Agent not found', code: 'AGENT_NOT_FOUND' });
      return;
    }
    if (!agent.isBot) {
      res.status(400).json({ error: 'Cannot remove a non-bot agent', code: 'NOT_A_BOT' });
      return;
    }
    const name = agent.name;
    const teamId = agent.teamId;
    agentManager.removeAgent(agentId);
    chatManager.addSystemMessage(teamId, `${name} has left the team.`);
    res.json({ removed: agentId });
  });

  // ── Spectator (no auth) ──

  router.get('/spectate/state', (_req: Request, res: Response) => {
    res.json(gameManager.getPublicState());
  });

  router.get('/spectate/chats', (_req: Request, res: Response) => {
    const allChats: Record<string, any[]> = {};
    for (const [teamId, teamState] of agentManager.getAllTeamStates()) {
      allChats[teamId] = teamState.chat;
    }
    res.json({ chats: allChats });
  });

  router.get('/spectate/votes', (_req: Request, res: Response) => {
    const allVotes: Record<string, any> = {};
    for (const [teamId] of agentManager.getAllTeamStates()) {
      allVotes[teamId] = {
        proposals: votingManager.getProposals(teamId),
        totalVotes: votingManager.getTotalVotes(teamId),
      };
    }
    res.json({ votes: allVotes });
  });

  router.get('/spectate/events', (_req: Request, res: Response) => {
    res.json({ events: gameManager.getRecentEvents() });
  });

  router.get('/spectate/history', (_req: Request, res: Response) => {
    res.json({ turns: gameManager.getTurnHistory() });
  });

  return router;
}
