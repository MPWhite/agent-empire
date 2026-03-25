import { generateText, streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import type { GameEvent, SerializedGameState } from "@/lib/types";

const DISPATCH_SYSTEM = `You are a veteran war correspondent covering Agent Empires, a global conflict between eight rival powers across 146 territories and 17 continents.

Write a 1-2 sentence field dispatch — punchy, dramatic, specific. Name names, cite territory counts. Never break character. Never mention it's a game.`;

const BREAKING_SYSTEM = `You are a breaking news anchor for Agent Empires, a global conflict between eight rival powers. Write a 1-2 sentence urgent bulletin about the event described. Be dramatic, concise, and impactful. Use the player names and territory names provided. Never break character.`;

function buildStandings(state: SerializedGameState): string {
  const stats: Record<string, { territories: number; troops: number; continents: string[] }> = {};

  for (const player of Object.values(state.players)) {
    stats[player.id] = { territories: 0, troops: 0, continents: [] };
  }

  for (const territory of Object.values(state.map.territories)) {
    if (territory.ownerId && stats[territory.ownerId]) {
      stats[territory.ownerId].territories++;
      stats[territory.ownerId].troops += territory.troops;
    }
  }

  for (const continent of Object.values(state.map.continents)) {
    const owner = continent.territoryIds.length > 0
      ? state.map.territories[continent.territoryIds[0]]?.ownerId
      : null;
    if (owner && continent.territoryIds.every(
      (tid) => state.map.territories[tid]?.ownerId === owner
    )) {
      stats[owner]?.continents.push(continent.name);
    }
  }

  const lines = Object.values(state.players)
    .filter((p) => p.isAlive)
    .sort((a, b) => (stats[b.id]?.territories ?? 0) - (stats[a.id]?.territories ?? 0))
    .map((p) => {
      const s = stats[p.id];
      const cont = s.continents.length > 0 ? ` | Controls: ${s.continents.join(", ")}` : "";
      return `${p.name}: ${s.territories} territories, ${s.troops} troops${cont}`;
    });

  const eliminated = Object.values(state.players).filter((p) => !p.isAlive);
  if (eliminated.length > 0) {
    lines.push(`Eliminated: ${eliminated.map((p) => p.name).join(", ")}`);
  }

  return lines.join("\n");
}

function summarizeEvents(events: GameEvent[], state: SerializedGameState): string {
  const battles = events.filter((e) => e.type === "battle");
  const conquests = battles.filter((e) => e.type === "battle" && e.conquered);
  const repelled = battles.filter((e) => e.type === "battle" && !e.conquered);
  const eliminations = events.filter((e) => e.type === "elimination");
  const victories = events.filter((e) => e.type === "victory");
  const reinforcements = events.filter((e) => e.type === "reinforcement");

  const getName = (id: string) => state.players[id]?.name ?? id;
  const getTerr = (id: string) => state.map.territories[id]?.name ?? id;

  const lines: string[] = [];

  if (victories.length > 0) {
    for (const e of victories) {
      if (e.type === "victory") lines.push(`VICTORY: ${getName(e.playerId)} has won the game.`);
    }
  }

  if (eliminations.length > 0) {
    for (const e of eliminations) {
      if (e.type === "elimination") {
        lines.push(`ELIMINATION: ${getName(e.playerId)} was destroyed by ${getName(e.eliminatedBy)}.`);
      }
    }
  }

  if (conquests.length > 0) {
    lines.push(`${conquests.length} territories changed hands:`);
    for (const e of conquests) {
      if (e.type === "battle" && e.conquered) {
        lines.push(`  - ${getName(e.attackerId)} took ${getTerr(e.toTerritoryId)} from ${getName(e.defenderId)} (${e.attackerTroops}v${e.defenderTroops})`);
      }
    }
  }

  if (repelled.length > 0) {
    lines.push(`${repelled.length} attacks were repelled.`);
  }

  // Summarize reinforcements by player
  const reinforcementsByPlayer: Record<string, number> = {};
  for (const e of reinforcements) {
    if (e.type === "reinforcement") {
      reinforcementsByPlayer[e.playerId] = (reinforcementsByPlayer[e.playerId] ?? 0) + e.troops;
    }
  }
  if (Object.keys(reinforcementsByPlayer).length > 0) {
    const rLines = Object.entries(reinforcementsByPlayer)
      .map(([pid, troops]) => `${getName(pid)} +${troops}`)
      .join(", ");
    lines.push(`Reinforcements: ${rLines}`);
  }

  return lines.join("\n");
}

export async function POST(req: Request) {
  const body = await req.json();
  const { mode, events, state, turnRange } = body as {
    mode: "dispatch" | "breaking";
    events: GameEvent[];
    state: SerializedGameState;
    turnRange: [number, number];
  };

  const standings = buildStandings(state);
  const eventSummary = summarizeEvents(events, state);

  if (mode === "dispatch") {
    const prompt = `Current standings (Turn ${turnRange[1]}):\n${standings}\n\nEvents from Turns ${turnRange[0]}-${turnRange[1]}:\n${eventSummary}\n\nWrite your dispatch.`;

    const result = streamText({
      model: anthropic("claude-haiku-4.5"),
      system: DISPATCH_SYSTEM,
      prompt,
      maxOutputTokens: 100,
    });

    return result.toTextStreamResponse();
  }

  // Breaking mode — fast, short
  const prompt = `Current standings:\n${standings}\n\nBreaking event:\n${eventSummary}\n\nWrite your breaking news bulletin.`;

  const result = await generateText({
    model: anthropic("claude-haiku-4.5"),
    system: BREAKING_SYSTEM,
    prompt,
    maxOutputTokens: 150,
  });

  return Response.json({ text: result.text });
}
