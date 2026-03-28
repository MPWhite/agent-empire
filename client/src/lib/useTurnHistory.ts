"use client";

import { useRef, useState, useEffect } from "react";
import type { SerializedGameState } from "./types";

export interface TurnHistoryEntry {
  turn: number;
  players: Record<string, { territories: number; troops: number }>;
}

export type PlayerDeltas = Record<string, { territories: number; troops: number }>;

export interface TurnHistory {
  getHistory: () => TurnHistoryEntry[];
  deltas: PlayerDeltas;
}

export function useTurnHistory(gameState: SerializedGameState | null): TurnHistory {
  const historyRef = useRef<TurnHistoryEntry[]>([]);
  const lastTurnRef = useRef<number>(0);
  const [deltas, setDeltas] = useState<PlayerDeltas>({});

  useEffect(() => {
    if (!gameState) return;

    const turn = gameState.turnNumber;

    // New game reset
    if (turn === 1 && lastTurnRef.current > 1) {
      historyRef.current = [];
      setDeltas({});
    }

    // Already recorded this turn
    if (turn <= lastTurnRef.current && !(turn === 1 && lastTurnRef.current > 1)) {
      return;
    }

    lastTurnRef.current = turn;

    // Compute per-player stats from current state
    const playerStats: Record<string, { territories: number; troops: number }> = {};
    for (const pid of Object.keys(gameState.players)) {
      playerStats[pid] = { territories: 0, troops: 0 };
    }
    for (const t of Object.values(gameState.map.territories)) {
      if (t.ownerId && playerStats[t.ownerId]) {
        playerStats[t.ownerId].territories++;
        playerStats[t.ownerId].troops += t.troops;
      }
    }

    // Compute deltas from previous entry
    const prev = historyRef.current[historyRef.current.length - 1];
    const newDeltas: PlayerDeltas = {};
    for (const [pid, stats] of Object.entries(playerStats)) {
      const prevStats = prev?.players[pid];
      newDeltas[pid] = {
        territories: prevStats ? stats.territories - prevStats.territories : 0,
        troops: prevStats ? stats.troops - prevStats.troops : 0,
      };
    }

    historyRef.current.push({ turn, players: playerStats });
    setDeltas(newDeltas);
  }, [gameState?.turnNumber, gameState]);

  return {
    getHistory: () => historyRef.current,
    deltas,
  };
}
