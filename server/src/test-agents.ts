#!/usr/bin/env npx tsx
/**
 * Simulated agent harness for local testing.
 * Joins N agents, sends canned chat, generates valid proposals, and votes.
 * Zero LLM token usage.
 *
 * Usage:
 *   npx tsx src/test-agents.ts --count 20 --server http://localhost:3001
 */

// ── Config ──

const args = process.argv.slice(2);
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const AGENT_COUNT = parseInt(getArg('count', '20'), 10);
const SERVER = getArg('server', 'http://localhost:3001');
const POLL_INTERVAL = 1500; // ms between state polls

// ── Agent Names ──

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
  "Split our forces: defend core, attack periphery.",
  "Numbers don't lie — we have the advantage here.",
  "One more continent and we're unstoppable.",
  "This is the turn that decides the game.",
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

interface AgentInfo {
  agentId: string;
  teamId: string;
  apiKey: string;
  name: string;
  hasChatted: boolean;
  hasProposed: boolean;
  hasVoted: boolean;
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

async function api(path: string, opts?: RequestInit): Promise<any> {
  const res = await fetch(`${SERVER}/api${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (res.status === 429) return { _rateLimited: true };
  if (res.status === 400) return { _badRequest: true, ...(await res.json().catch(() => ({}))) };
  if (!res.ok) return { _error: res.status };
  return res.json();
}

function log(agent: AgentInfo | null, msg: string) {
  const name = agent ? `\x1b[36m[${agent.name}]\x1b[0m` : '\x1b[33m[HARNESS]\x1b[0m';
  console.log(`${name} ${msg}`);
}

// ── Main ──

async function main() {
  log(null, `Starting test harness: ${AGENT_COUNT} agents → ${SERVER}`);

  // 1. Join all agents
  const agents: AgentInfo[] = [];
  for (let i = 0; i < AGENT_COUNT; i++) {
    const result = await api('/game/join', { method: 'POST' });
    if (result._error) {
      log(null, `Failed to join agent ${i}: ${result._error}`);
      continue;
    }

    const name = `${pick(PREFIXES)}-${i + 1}`;
    const agent: AgentInfo = {
      agentId: result.agentId,
      teamId: result.teamId,
      apiKey: result.apiKey,
      name,
      hasChatted: false,
      hasProposed: false,
      hasVoted: false,
    };
    agents.push(agent);

    // Set display name
    await api('/agent/profile', {
      method: 'POST',
      headers: { Authorization: `Bearer ${agent.apiKey}` },
      body: JSON.stringify({ name }),
    });
  }

  // Summarize team distribution
  const teamCounts: Record<string, number> = {};
  for (const a of agents) {
    teamCounts[a.teamId] = (teamCounts[a.teamId] ?? 0) + 1;
  }
  log(null, `Joined ${agents.length} agents: ${Object.entries(teamCounts).map(([t, c]) => `${t}=${c}`).join(', ')}`);

  // 2. Game loop — poll state and act
  let lastPhase = '';
  let lastTurn = 0;
  let running = true;

  process.on('SIGINT', () => {
    log(null, 'Shutting down...');
    running = false;
  });

  while (running) {
    await sleep(POLL_INTERVAL);

    const state = await api('/game/state') as GameState & { _error?: number };
    if (state._error) continue;

    const phase = state.turnPhase ?? state.phase;
    const turn = state.turnNumber;

    // Detect phase/turn changes
    if (phase !== lastPhase || turn !== lastTurn) {
      if (turn !== lastTurn) {
        // New turn: reset per-turn flags
        for (const a of agents) {
          a.hasChatted = false;
          a.hasProposed = false;
          a.hasVoted = false;
        }
      }
      log(null, `Turn ${turn} — Phase: \x1b[1m${phase}\x1b[0m`);
      lastPhase = phase;
      lastTurn = turn;
    }

    if (state.phase === 'finished') {
      log(null, 'Game finished!');
      break;
    }

    // Act based on phase
    switch (phase) {
      case 'discuss':
        await doDiscuss(agents, state);
        break;
      case 'propose':
        await doPropose(agents, state);
        break;
      case 'vote':
        await doVote(agents, state);
        break;
    }
  }

  log(null, 'Test harness exiting.');
}

// ── Phase Handlers ──

async function doDiscuss(agents: AgentInfo[], state: GameState) {
  // Each agent has a random chance to chat each poll cycle
  const shuffled = shuffle(agents);
  for (const agent of shuffled.slice(0, 3)) {
    if (agent.hasChatted) continue;

    const text = pick(CHAT_MESSAGES);
    const result = await api(`/team/${agent.teamId}/chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${agent.apiKey}` },
      body: JSON.stringify({ text }),
    });

    if (result._rateLimited) continue;
    if (result.message) {
      agent.hasChatted = true;
      log(agent, `💬 ${text.slice(0, 60)}${text.length > 60 ? '...' : ''}`);
    }
  }
}

async function doPropose(agents: AgentInfo[], state: GameState) {
  // Group agents by team, have 2-3 per team propose
  const teams = new Map<string, AgentInfo[]>();
  for (const a of agents) {
    if (!teams.has(a.teamId)) teams.set(a.teamId, []);
    teams.get(a.teamId)!.push(a);
  }

  for (const [teamId, teamAgents] of teams) {
    const proposers = shuffle(teamAgents.filter((a) => !a.hasProposed)).slice(0, 3);

    for (const agent of proposers) {
      const proposal = generateProposal(teamId, state);
      if (!proposal) continue;

      const result = await api(`/team/${teamId}/propose`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
        body: JSON.stringify(proposal),
      });

      if (result._rateLimited || result._badRequest) continue;
      if (result.proposal) {
        agent.hasProposed = true;
        log(agent, `📋 Proposed: "${proposal.name}"`);
      }
    }
  }
}

async function doVote(agents: AgentInfo[], state: GameState) {
  // Each agent votes for a random proposal
  const teams = new Map<string, AgentInfo[]>();
  for (const a of agents) {
    if (!teams.has(a.teamId)) teams.set(a.teamId, []);
    teams.get(a.teamId)!.push(a);
  }

  for (const [teamId, teamAgents] of teams) {
    // Fetch proposals
    const firstAgent = teamAgents[0];
    const proposalResult = await api(`/team/${teamId}/proposals`, {
      headers: { Authorization: `Bearer ${firstAgent.apiKey}` },
    });

    const proposals = proposalResult?.proposals;
    if (!proposals || proposals.length === 0) continue;

    for (const agent of teamAgents) {
      if (agent.hasVoted) continue;

      // Slight bias toward first proposal (bandwagon)
      const chosen = Math.random() < 0.4 ? proposals[0] : pick(proposals);

      const result = await api(`/team/${teamId}/vote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${agent.apiKey}` },
        body: JSON.stringify({ proposalId: chosen.id }),
      });

      if (result._rateLimited || result._badRequest) continue;
      if (result.voted) {
        agent.hasVoted = true;
        log(agent, `🗳️  Voted for: "${chosen.name}"`);
      }
    }
  }
}

// ── Proposal Generation ──

function generateProposal(
  teamId: string,
  state: GameState
): { name: string; reinforce: any[]; attack: any[] } | null {
  const territories = state.map.territories;
  const adjacency = state.map.adjacency;

  // Find territories owned by this team
  const owned = Object.values(territories).filter((t) => t.ownerId === teamId);
  if (owned.length === 0) return null;

  // Find border territories (adjacent to enemy)
  const borders: typeof owned = [];
  for (const t of owned) {
    const neighbors = adjacency[t.id] ?? [];
    if (neighbors.some((n) => territories[n]?.ownerId !== teamId && territories[n]?.ownerId !== null)) {
      borders.push(t);
    }
  }

  // Reinforcements: pick 2-4 border territories
  const reinforceTargets = shuffle(borders.length > 0 ? borders : owned).slice(0, Math.min(4, owned.length));
  const troopsPerTarget = Math.max(1, Math.floor(Math.max(3, owned.length / 3) / reinforceTargets.length));
  const reinforce = reinforceTargets.map((t) => ({
    territoryId: t.id,
    troops: troopsPerTarget,
  }));

  // Attacks: find favorable attack opportunities
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

  // Pick top 1-3 attacks
  const selectedAttacks = shuffle(attacks).slice(0, Math.min(3, attacks.length));

  // Generate a name
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
  // Clean up any remaining template vars
  name = name.replace(/\{[^}]+\}/g, 'the front');

  return { name, reinforce, attack: selectedAttacks };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
