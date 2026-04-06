// server/src/narrative-engine.ts
import { generateText, Output } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import type { GameState, GameEvent } from 'engine';
import type { ChatMessage } from './types.js';

export interface TurnNarrative {
  contextLines: Array<{
    eventIndex: number;
    context: string;
  }>;
  commsHighlights: Array<{
    teamId: string;
    headline: string;
    quotes: Array<{
      agentName: string;
      teamId: string;
      text: string;
    }>;
    context: string;
    timestamp: number;
  }>;
}

const EMPTY_NARRATIVE: TurnNarrative = { contextLines: [], commsHighlights: [] };

const narrativeSchema = z.object({
  contextLines: z.array(z.object({
    eventIndex: z.number(),
    context: z.string(),
  })),
  commsHighlights: z.array(z.object({
    teamId: z.string(),
    headline: z.string(),
    quotes: z.array(z.object({
      agentName: z.string(),
      teamId: z.string(),
      text: z.string(),
    })),
    context: z.string(),
    timestamp: z.number(),
  })),
});

const SYSTEM = `You are a war analyst for Agent Empires, a global strategy game between rival empires across 146 territories. Given a turn's events, team chat messages, and game context, produce:

1. "contextLines": For strategically significant events ONLY, a short "why it matters" explanation (1-2 sentences). Reference trends ("3rd attack in 5 turns"), strategic implications ("controls the chokepoint"), or power shifts. Skip minor/routine events — most turns will have 0-3 context lines.

2. "commsHighlights": If any team's chat this turn contains something narratively interesting (betrayal discussions, heated debates, alliance pivots, threats), extract 1-3 key quotes and explain the significance. Most turns will have 0 comms highlights.

Be dramatic but factual. Use player names, not IDs. Never break character.`;

function buildPrompt(
  events: GameEvent[],
  chats: Record<string, ChatMessage[]>,
  state: GameState,
  recentEvents: GameEvent[],
): string {
  // Player standings
  const standings: string[] = [];
  const territoryCounts: Record<string, number> = {};
  for (const [, t] of state.map.territories) {
    if (t.ownerId) territoryCounts[t.ownerId] = (territoryCounts[t.ownerId] ?? 0) + 1;
  }
  for (const [id, player] of state.players) {
    if (!player.isAlive) continue;
    standings.push(`${player.name} (${id}): ${territoryCounts[id] ?? 0} territories, mil=${player.tech.military} eco=${player.tech.economic} intel=${player.tech.intelligence}`);
  }

  // Events summary
  const eventLines = events.map((e, i) => {
    const line = `[${i}] ${e.type}`;
    if (e.type === 'battle') return `${line}: ${e.attackerId} attacked ${e.toTerritoryId} (${e.attackerTroops}v${e.defenderTroops}, ${e.conquered ? 'conquered' : 'repelled'})`;
    if (e.type === 'research') return `${line}: ${e.playerId} reached ${e.branch} level ${e.newLevel}`;
    if (e.type === 'elimination') return `${line}: ${e.playerId} eliminated by ${e.eliminatedBy}`;
    if (e.type === 'nuke') return `${line}: ${e.attackerId} nuked ${e.targetTerritoryId}`;
    if (e.type === 'diplomacyEvent') return `${line}: ${e.subtype} — ${e.playerId}${e.targetPlayerId ? ` / ${e.targetPlayerId}` : ''}`;
    if (e.type === 'spyEvent') return `${line}: ${e.subtype} — ${e.attackerId} → ${e.targetId}`;
    if (e.type === 'conquest') return `${line}: ${e.playerId} captured ${e.territoryId}`;
    if (e.type === 'missileStrike') return `${line}: ${e.attackerId} struck ${e.targetTerritoryId}`;
    return line;
  });

  // Chat summary (non-system messages only)
  const chatLines: string[] = [];
  for (const [teamId, messages] of Object.entries(chats)) {
    const playerMsgs = messages.filter(m => m.agentId !== 'system');
    if (playerMsgs.length === 0) continue;
    const playerName = state.players.get(teamId)?.name ?? teamId;
    chatLines.push(`--- ${playerName} (${teamId}) ---`);
    for (const msg of playerMsgs.slice(-10)) {
      chatLines.push(`  ${msg.agentName}: "${msg.text}"`);
    }
  }

  // Recent events context (last 5 turns)
  const recentSummary = recentEvents.length > 0
    ? `Recent history (previous turns): ${recentEvents.filter(e => e.type === 'battle' || e.type === 'conquest' || e.type === 'elimination' || e.type === 'nuke').map(e => e.type === 'battle' ? `${(e as any).attackerId} attacked ${(e as any).toTerritoryId}` : e.type).join('; ')}`
    : '';

  return `Turn ${state.turnNumber - 1} Results:

Standings:
${standings.join('\n')}

Events this turn:
${eventLines.join('\n')}

${chatLines.length > 0 ? `Team comms this turn:\n${chatLines.join('\n')}` : 'No team comms this turn.'}

${recentSummary}

Player name mapping: ${[...state.players.entries()].map(([id, p]) => `${id}=${p.name}`).join(', ')}
Territory names are IDs like "egypt", "brazil", etc.`;
}

export async function generateTurnNarrative(
  events: GameEvent[],
  chats: Record<string, ChatMessage[]>,
  state: GameState,
  recentEvents: GameEvent[],
): Promise<TurnNarrative> {
  // Skip if no significant events
  const significant = events.filter(e =>
    e.type !== 'resourceProduction' && e.type !== 'reinforcement'
  );
  if (significant.length === 0) return EMPTY_NARRATIVE;

  try {
    const result = await generateText({
      model: anthropic('claude-haiku-4-5'),
      system: SYSTEM,
      prompt: buildPrompt(events, chats, state, recentEvents),
      output: Output.object({ schema: narrativeSchema }),
      maxOutputTokens: 500,
    });
    return result.output as TurnNarrative;
  } catch (err) {
    console.error('Failed to generate turn narrative:', err);
    return EMPTY_NARRATIVE;
  }
}
