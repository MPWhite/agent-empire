import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { GameState, GameEvent } from 'engine';

// ── Data Types ──

export interface TurnSnapshot {
  turnNumber: number;
  territories: Record<string, { ownerId: string | null; troops: number }>;
  players: Record<string, { isAlive: boolean }>;
}

export type MajorEventType = 'elimination' | 'continent_capture' | 'major_war' | 'game_start' | 'victory';

export interface MajorEvent {
  turnNumber: number;
  type: MajorEventType;
  territoryIds: string[];
  playerIds: string[];
  summary: string;
  label: string;
}

export interface GameHistory {
  gameId: string;
  startedAt: string;
  playerNames: Record<string, { name: string; color: string }>;
  turns: TurnSnapshot[];
  majorEvents: MajorEvent[];
}

// ── File I/O ──

const SAVE_PATH = process.env.SAVE_PATH ?? '.';

function getHistoryPath(): string {
  const savePath = process.env.SAVE_PATH ?? './game-state.json';
  const dir = savePath.endsWith('.json') ? dirname(savePath) : savePath;
  return join(dir, 'game-history.json');
}

export function saveHistory(history: GameHistory): void {
  writeFileSync(getHistoryPath(), JSON.stringify(history));
}

export function loadHistory(): GameHistory | null {
  const path = getHistoryPath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── History Management ──

export function createHistory(state: GameState): GameHistory {
  const playerNames: Record<string, { name: string; color: string }> = {};
  for (const [id, player] of state.players) {
    playerNames[id] = { name: player.name, color: player.color };
  }

  const history: GameHistory = {
    gameId: randomUUID(),
    startedAt: new Date().toISOString(),
    playerNames,
    turns: [],
    majorEvents: [],
  };

  // Add initial turn snapshot
  appendTurn(history, state);

  // Add game_start event
  const allTerritoryIds = Array.from(state.map.territories.keys());
  const allPlayerIds = Array.from(state.players.keys());
  addMajorEvent(history, {
    turnNumber: state.turnNumber,
    type: 'game_start',
    territoryIds: allTerritoryIds.slice(0, 10), // representative sample
    playerIds: allPlayerIds,
    summary: '',
    label: 'GAME START',
  });

  return history;
}

export function appendTurn(history: GameHistory, state: GameState): void {
  const territories: Record<string, { ownerId: string | null; troops: number }> = {};
  for (const [id, t] of state.map.territories) {
    territories[id] = { ownerId: t.ownerId, troops: t.troops };
  }

  const players: Record<string, { isAlive: boolean }> = {};
  for (const [id, p] of state.players) {
    players[id] = { isAlive: p.isAlive };
  }

  history.turns.push({
    turnNumber: state.turnNumber,
    players,
    territories,
  });
}

export function addMajorEvent(history: GameHistory, event: MajorEvent): void {
  history.majorEvents.push(event);
}

// ── Major Event Detection ──

export function detectMajorEvents(
  previousState: GameState,
  currentState: GameState,
  events: GameEvent[],
): MajorEvent[] {
  const detected: MajorEvent[] = [];
  const turnNumber = currentState.turnNumber - 1; // events are from the just-resolved turn

  // Eliminations
  for (const event of events) {
    if (event.type === 'elimination') {
      const playerName = currentState.players.get(event.playerId)?.name ?? event.playerId;
      detected.push({
        turnNumber,
        type: 'elimination',
        territoryIds: [], // will be filled below
        playerIds: [event.eliminatedBy, event.playerId],
        summary: '',
        label: `${playerName.toUpperCase()} ☠`,
      });
    }

    if (event.type === 'victory') {
      const playerName = currentState.players.get(event.playerId)?.name ?? event.playerId;
      detected.push({
        turnNumber,
        type: 'victory',
        territoryIds: [],
        playerIds: [event.playerId],
        summary: '',
        label: 'VICTORY',
      });
    }
  }

  // Continent captures — check if any player now owns 100% of a continent they didn't before
  for (const [continentId, continent] of currentState.map.continents) {
    const tIds = continent.territoryIds;
    if (tIds.length === 0) continue;

    const currentOwner = currentState.map.territories.get(tIds[0])?.ownerId;
    if (!currentOwner) continue;

    const ownsAll = tIds.every(
      (tid) => currentState.map.territories.get(tid)?.ownerId === currentOwner,
    );
    if (!ownsAll) continue;

    // Did they own it all before this turn?
    const ownedBefore = tIds.every(
      (tid) => previousState.map.territories.get(tid)?.ownerId === currentOwner,
    );
    if (ownedBefore) continue;

    const playerName = currentState.players.get(currentOwner)?.name ?? currentOwner;
    detected.push({
      turnNumber,
      type: 'continent_capture',
      territoryIds: tIds,
      playerIds: [currentOwner],
      summary: '',
      label: continent.name.toUpperCase(),
    });
  }

  // Major wars — a turn where a single pair of players had 3+ battles
  const pairCounts = new Map<string, { count: number; territoryIds: string[] }>();
  for (const event of events) {
    if (event.type !== 'battle') continue;
    const key = [event.attackerId, event.defenderId].sort().join(':');
    const entry = pairCounts.get(key) ?? { count: 0, territoryIds: [] };
    entry.count++;
    entry.territoryIds.push(event.toTerritoryId);
    pairCounts.set(key, entry);
  }

  for (const [key, data] of pairCounts) {
    if (data.count < 3) continue;
    const [pid1, pid2] = key.split(':');
    const name1 = currentState.players.get(pid1)?.name ?? pid1;
    const name2 = currentState.players.get(pid2)?.name ?? pid2;
    detected.push({
      turnNumber,
      type: 'major_war',
      territoryIds: data.territoryIds,
      playerIds: [pid1, pid2],
      summary: '',
      label: `${name1.toUpperCase()} vs ${name2.toUpperCase()}`,
    });
  }

  // Fill in territoryIds for eliminations (last territories the eliminated player lost)
  for (const det of detected) {
    if (det.type === 'elimination' && det.territoryIds.length === 0) {
      // Find territories the eliminated player owned in the previous state
      const eliminatedId = det.playerIds[1];
      const lastTerritories: string[] = [];
      for (const [tid, t] of previousState.map.territories) {
        if (t.ownerId === eliminatedId) lastTerritories.push(tid);
      }
      det.territoryIds = lastTerritories.slice(0, 10);
    }
  }

  return detected;
}
