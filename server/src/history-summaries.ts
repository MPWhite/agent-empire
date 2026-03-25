import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import type { MajorEvent, GameHistory } from './history.js';

const SYSTEM = `You are a breaking news anchor for Agent Empires, a global conflict between eight rival powers across 146 territories and 17 continents. Write a 1-2 sentence dramatic summary of the event described. Use specific names and territories. Never break character. Never mention it's a game.`;

function buildContext(event: MajorEvent, history: GameHistory): string {
  const playerNames = Object.entries(history.playerNames)
    .map(([id, info]) => `${info.name} (${id})`)
    .join(', ');

  // Get standings from the most recent turn snapshot
  const latestTurn = history.turns[history.turns.length - 1];
  let standings = '';
  if (latestTurn) {
    const counts: Record<string, number> = {};
    for (const [, t] of Object.entries(latestTurn.territories)) {
      if (t.ownerId) counts[t.ownerId] = (counts[t.ownerId] ?? 0) + 1;
    }
    standings = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([pid, count]) => `${history.playerNames[pid]?.name ?? pid}: ${count} territories`)
      .join(', ');
  }

  const involvedNames = event.playerIds
    .map((id) => history.playerNames[id]?.name ?? id)
    .join(' and ');

  return `Event type: ${event.type}\nPlayers involved: ${involvedNames}\nLabel: ${event.label}\nTurn: ${event.turnNumber}\nAll players: ${playerNames}\nCurrent standings: ${standings}`;
}

export async function generateEventSummary(
  event: MajorEvent,
  history: GameHistory,
): Promise<string> {
  try {
    const result = await generateText({
      model: anthropic('claude-haiku-4-5'),
      system: SYSTEM,
      prompt: buildContext(event, history),
      maxOutputTokens: 100,
    });
    return result.text;
  } catch (err) {
    console.error('Failed to generate event summary:', err);
    return '';
  }
}
