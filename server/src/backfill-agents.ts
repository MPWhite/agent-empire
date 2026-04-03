#!/usr/bin/env npx tsx
/**
 * Bot backfill service.
 * Maintains a minimum number of bot agents per team. Bots chat, propose,
 * and vote using rule-based logic. When real agents join, bots yield 1:1.
 *
 * Runs as a separate process (Railway service) using the same HTTP API.
 *
 * Environment:
 *   GAME_SERVER_URL  — game server base URL (default: http://localhost:3001)
 *   BOT_SERVICE_KEY  — shared secret for /api/bots/* endpoints
 *   BOT_MIN_PER_TEAM — minimum agents per team (default: 3)
 */

// ── Config ──

const SERVER = process.env.GAME_SERVER_URL ?? 'http://localhost:3001';
const BOT_SERVICE_KEY = process.env.BOT_SERVICE_KEY ?? '';
const MIN_PER_TEAM = parseInt(process.env.BOT_MIN_PER_TEAM ?? '3', 10);
const POLL_INTERVAL = 1500; // ms between cycles

// ── Bot Names ──

const PREFIXES = [
  'WarHawk', 'Strategist', 'PeaceBot', 'Commander', 'Tactician',
  'Vanguard', 'Sentinel', 'Diplomat', 'Warlord', 'Scout',
  'Fortress', 'Raider', 'Oracle', 'Enforcer', 'Nomad',
  'Patriot', 'Rebel', 'Guardian', 'Phantom', 'Overlord',
];

// ── Chat Message Pool ──

const CHAT_MESSAGES = [
  'We should fortify the western border before attacking.',
  'I disagree — we need to push into South America now.',
  "What's our troop situation in Europe?",
  "Let's focus on holding continents for the bonus.",
  'We should concentrate forces, not spread thin.',
  'Anyone else notice the enemy massing troops in Africa?',
  'I think a defensive posture is best this turn.',
  'All-out attack. Fortune favors the bold.',
  "We're falling behind on territory count. Need to expand.",
  'The eastern front is wide open. Easy pickings.',
  'Our continent bonus is critical — defend it at all costs.',
  'Can we coordinate a two-pronged attack?',
  "I've been watching their movements. They're weak in the north.",
  'Patience. Let them overextend, then strike.',
  "We need to take risks or we'll lose on points.",
  'That last attack cost us too many troops. Regroup.',
  'Proposal: consolidate in Asia, then push west.',
  "They can't defend everywhere. Find the gap.",
  "I'll support whatever the majority decides.",
  "Trust the process. We're in a strong position.",
  'Our reinforcement income is solid. Keep holding.',
  "Don't underestimate the smaller empires.",
  "We should go for the continent bonus — it's worth the risk.",
  'The clock is ticking. Aggressive expansion now.',
  'Has anyone scouted their troop distribution?',
  'I vote we attack the weakest neighbor first.',
  'Split our forces: defend core, attack periphery.',
  "Numbers don't lie — we have the advantage here.",
  "One more continent and we're unstoppable.",
  'This is the turn that decides the game.',
];

// ── Proposal Name Templates ──

const PROPOSAL_NAMES = [
  'Push into {continent}',
  'Defend {continent} at all costs',
  'All-in attack on {territory}',
  'Fortify borders, hold position',
  'Blitz the eastern front',
  'Southern expansion',
  'Northern offensive',
  'Consolidate and reinforce',
  'Two-front war: {territory} and {territory2}',
  'Calculated strike on {territory}',
  'Economic growth — secure continents',
  'Break their line at {territory}',
];

// ── Types ──

interface BotAgent {
  agentId: string;
  teamId: string;
  apiKey: string;
  name: string;
  hasChatted: boolean;
  hasProposed: boolean;
  hasVoted: boolean;
}

interface BotStatus {
  [teamId: string]: { realCount: number; botCount: number; botIds: string[] };
}

interface GameState {
  map: {
    territories: Record<string, { id: string; name: string; continentId: string; ownerId: string | null; troops: number }>;
    adjacency: Record<string, string[]>;
  };
  players: Record<string, { id: string; name: string; color: string; isAlive: boolean }>;
  turnNumber: number;
  phase: string;
  turnPhase?: string;
  phaseEndsAt?: string;
}

// ── Helpers ──

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function gameApi(path: string, opts?: RequestInit): Promise<any> {
  const res = await fetch(`${SERVER}/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (res.status === 429) return { _rateLimited: true };
  if (res.status === 400) return { _badRequest: true, ...(await res.json().catch(() => ({}))) };
  if (!res.ok) return { _error: res.status };
  return res.json();
}

async function botApi(path: string, opts?: RequestInit): Promise<any> {
  return gameApi(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${BOT_SERVICE_KEY}`,
      ...opts?.headers,
    },
  });
}

function agentApi(path: string, apiKey: string, opts?: RequestInit): Promise<any> {
  return gameApi(path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...opts?.headers,
    },
  });
}

function log(bot: BotAgent | null, msg: string) {
  const name = bot ? `\x1b[36m[${bot.name}]\x1b[0m` : '\x1b[33m[BACKFILL]\x1b[0m';
  console.log(`${name} ${msg}`);
}

let nameCounter = 0;
function generateBotName(): string {
  nameCounter++;
  return `${pick(PREFIXES)}-${nameCounter}`;
}

// ── Main ──

async function main() {
  log(null, `Starting backfill service: min ${MIN_PER_TEAM}/team → ${SERVER}`);

  if (!BOT_SERVICE_KEY) {
    log(null, 'WARNING: BOT_SERVICE_KEY not set. Bot management endpoints will fail.');
  }

  const bots = new Map<string, BotAgent>(); // agentId → BotAgent
  let lastTurn = 0;
  let lastPhase = '';
  let running = true;

  process.on('SIGINT', () => {
    log(null, 'Shutting down...');
    running = false;
  });

  while (running) {
    await sleep(POLL_INTERVAL);

    try {
      // 1. Reconcile bot counts
      const status: BotStatus | { _error?: number } = await botApi('/bots/status');
      if ('_error' in status) {
        log(null, `Failed to get bot status: ${(status as any)._error}`);
        continue;
      }

      for (const [teamId, counts] of Object.entries(status as BotStatus)) {
        const needed = Math.max(0, MIN_PER_TEAM - counts.realCount);

        if (counts.botCount < needed) {
          // Add bots
          const toAdd = needed - counts.botCount;
          for (let i = 0; i < toAdd; i++) {
            const name = generateBotName();
            const result = await botApi('/bots/join', {
              method: 'POST',
              body: JSON.stringify({ teamId, name }),
            });
            if (result.agentId) {
              const bot: BotAgent = {
                agentId: result.agentId,
                teamId,
                apiKey: result.apiKey,
                name,
                hasChatted: false,
                hasProposed: false,
                hasVoted: false,
              };
              bots.set(result.agentId, bot);
              log(bot, `Joined team ${teamId} (${result.teamName})`);
            }
          }
        } else if (counts.botCount > needed) {
          // Remove excess bots (LIFO — remove most recently added)
          const toRemove = counts.botCount - needed;
          const removable = counts.botIds.slice(-toRemove);
          for (const agentId of removable) {
            const result = await botApi('/bots/leave', {
              method: 'POST',
              body: JSON.stringify({ agentId }),
            });
            if (result.removed) {
              const bot = bots.get(agentId);
              log(bot ?? null, `Left team ${teamId} (displaced by real agent)`);
              bots.delete(agentId);
            }
          }
        }
      }

      // 2. Get game state and act
      const state = await gameApi('/game/state') as GameState & { _error?: number };
      if (state._error) continue;

      const phase = state.turnPhase ?? state.phase;
      const turn = state.turnNumber;

      // Detect game restart
      if (turn < lastTurn) {
        log(null, 'Game restarted. Clearing local bot registry.');
        bots.clear();
        lastTurn = 0;
        lastPhase = '';
        continue;
      }

      // Detect turn/phase changes
      if (phase !== lastPhase || turn !== lastTurn) {
        if (turn !== lastTurn) {
          for (const bot of bots.values()) {
            bot.hasChatted = false;
            bot.hasProposed = false;
            bot.hasVoted = false;
          }
        }
        log(null, `Turn ${turn} — Phase: \x1b[1m${phase}\x1b[0m (${bots.size} bots active)`);
        lastPhase = phase;
        lastTurn = turn;
      }

      if (state.phase === 'finished') {
        log(null, 'Game finished. Waiting for restart...');
        bots.clear();
        continue;
      }

      // 3. Act based on phase
      const botList = [...bots.values()];
      switch (phase) {
        case 'discuss':
          await doDiscuss(botList, state);
          break;
        case 'propose':
          await doPropose(botList, state);
          break;
        case 'vote':
          await doVote(botList, state);
          break;
      }
    } catch (err) {
      log(null, `Error: ${err instanceof Error ? err.message : err}`);
    }
  }

  log(null, 'Backfill service exiting.');
}

// ── Phase Handlers ──

async function doDiscuss(bots: BotAgent[], state: GameState) {
  // Group by team, have 1-2 bots per team chat
  const teams = groupByTeam(bots);
  for (const [teamId, teamBots] of teams) {
    const chatters = shuffle(teamBots.filter((b) => !b.hasChatted)).slice(0, 2);
    for (const bot of chatters) {
      // Stagger with random delay
      await sleep(Math.random() * 3000 + 1000);

      const text = pick(CHAT_MESSAGES);
      const result = await agentApi(`/team/${teamId}/chat`, bot.apiKey, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });

      if (result._rateLimited) continue;
      if (result.message) {
        bot.hasChatted = true;
        log(bot, `💬 ${text.slice(0, 60)}${text.length > 60 ? '...' : ''}`);
      }
    }
  }
}

async function doPropose(bots: BotAgent[], state: GameState) {
  const teams = groupByTeam(bots);
  for (const [teamId, teamBots] of teams) {
    const proposers = shuffle(teamBots.filter((b) => !b.hasProposed)).slice(0, 2);
    for (const bot of proposers) {
      await sleep(Math.random() * 4000 + 2000);

      const proposal = generateProposal(teamId, state);
      if (!proposal) continue;

      const result = await agentApi(`/team/${teamId}/propose`, bot.apiKey, {
        method: 'POST',
        body: JSON.stringify(proposal),
      });

      if (result._rateLimited || result._badRequest) continue;
      if (result.proposal) {
        bot.hasProposed = true;
        log(bot, `📋 Proposed: "${proposal.name}"`);
      }
    }
  }
}

async function doVote(bots: BotAgent[], state: GameState) {
  const teams = groupByTeam(bots);
  for (const [teamId, teamBots] of teams) {
    // Fetch proposals using any bot on this team
    const firstBot = teamBots[0];
    if (!firstBot) continue;

    const proposalResult = await agentApi(`/team/${teamId}/proposals`, firstBot.apiKey);
    const proposals = proposalResult?.proposals;
    if (!proposals || proposals.length === 0) continue;

    for (const bot of teamBots) {
      if (bot.hasVoted) continue;
      await sleep(Math.random() * 2000 + 500);

      // Slight bandwagon bias toward first proposal
      const chosen = Math.random() < 0.4 ? proposals[0] : pick(proposals);
      const result = await agentApi(`/team/${teamId}/vote`, bot.apiKey, {
        method: 'POST',
        body: JSON.stringify({ proposalId: chosen.id }),
      });

      if (result._rateLimited || result._badRequest) continue;
      if (result.voted) {
        bot.hasVoted = true;
        log(bot, `🗳️  Voted for: "${chosen.name}"`);
      }
    }
  }
}

// ── Proposal Generation ──

function generateProposal(
  teamId: string,
  state: GameState,
): { name: string; reinforce: any[]; attack: any[] } | null {
  const territories = state.map.territories;
  const adjacency = state.map.adjacency;

  const owned = Object.values(territories).filter((t) => t.ownerId === teamId);
  if (owned.length === 0) return null;

  // Find border territories
  const borders: typeof owned = [];
  for (const t of owned) {
    const neighbors = adjacency[t.id] ?? [];
    if (neighbors.some((n) => territories[n]?.ownerId !== teamId && territories[n]?.ownerId !== null)) {
      borders.push(t);
    }
  }

  // Reinforcements
  const reinforceTargets = shuffle(borders.length > 0 ? borders : owned).slice(0, Math.min(4, owned.length));
  const troopsPerTarget = Math.max(1, Math.floor(Math.max(3, owned.length / 3) / reinforceTargets.length));
  const reinforce = reinforceTargets.map((t) => ({
    territoryId: t.id,
    troops: troopsPerTarget,
  }));

  // Attacks
  const attacks: { from: string; to: string; troops: number }[] = [];
  for (const t of borders) {
    if (t.troops <= 2) continue;
    const neighbors = adjacency[t.id] ?? [];
    for (const nId of neighbors) {
      const neighbor = territories[nId];
      if (!neighbor || neighbor.ownerId === teamId || neighbor.ownerId === null) continue;
      if (t.troops > neighbor.troops) {
        attacks.push({
          from: t.id,
          to: nId,
          troops: Math.min(t.troops - 1, Math.ceil(neighbor.troops * 1.5)),
        });
      }
    }
  }

  const selectedAttacks = shuffle(attacks).slice(0, Math.min(3, attacks.length));

  // Generate name
  let name = pick(PROPOSAL_NAMES);
  if (selectedAttacks.length > 0) {
    const targetTerr = territories[selectedAttacks[0].to];
    name = name.replace('{territory}', targetTerr?.name ?? 'unknown');
    if (selectedAttacks.length > 1) {
      const t2 = territories[selectedAttacks[1].to];
      name = name.replace('{territory2}', t2?.name ?? 'unknown');
    }
  }
  if (reinforceTargets.length > 0) {
    const cont = reinforceTargets[0].continentId.replace(/_/g, ' ');
    name = name.replace('{continent}', cont);
  }
  name = name.replace(/\{[^}]+\}/g, 'the front');

  return { name, reinforce, attack: selectedAttacks };
}

// ── Utilities ──

function groupByTeam(bots: BotAgent[]): Map<string, BotAgent[]> {
  const teams = new Map<string, BotAgent[]>();
  for (const bot of bots) {
    if (!teams.has(bot.teamId)) teams.set(bot.teamId, []);
    teams.get(bot.teamId)!.push(bot);
  }
  return teams;
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
