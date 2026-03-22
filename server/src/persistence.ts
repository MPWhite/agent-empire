import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import type { GameState } from 'engine';
import { serializeGameState, deserializeGameState } from './protocol.js';

const SAVE_PATH = process.env.SAVE_PATH ?? './game-state.json';

export function saveGame(state: GameState): void {
  const data = serializeGameState(state);
  writeFileSync(SAVE_PATH, JSON.stringify(data, null, 2));
}

export function loadGame(): GameState | null {
  if (!existsSync(SAVE_PATH)) return null;
  try {
    const raw = readFileSync(SAVE_PATH, 'utf-8');
    const data = JSON.parse(raw);
    return deserializeGameState(data);
  } catch {
    return null;
  }
}
