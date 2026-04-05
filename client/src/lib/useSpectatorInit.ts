"use client";

import { useState, useEffect } from "react";
import type { GameEvent } from "./types";
import type { TurnHistoryEntry } from "./useTurnHistory";

interface TurnSnapshot {
  turnNumber: number;
  territories: Record<string, { ownerId: string | null; troops: number }>;
  players: Record<string, { isAlive: boolean }>;
}

function computePlayerStatsFromSnapshot(snap: TurnSnapshot): Record<string, { territories: number; troops: number }> {
  const playerStats: Record<string, { territories: number; troops: number }> = {};
  for (const pid of Object.keys(snap.players)) {
    playerStats[pid] = { territories: 0, troops: 0 };
  }
  for (const t of Object.values(snap.territories)) {
    if (t.ownerId && playerStats[t.ownerId]) {
      playerStats[t.ownerId].territories++;
      playerStats[t.ownerId].troops += t.troops;
    }
  }
  return playerStats;
}

export function useSpectatorInit() {
  const [initialEvents, setInitialEvents] = useState<GameEvent[]>([]);
  const [initialHistory, setInitialHistory] = useState<TurnHistoryEntry[]>([]);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

    Promise.all([
      fetch(`${apiBase}/api/spectate/events`).then((r) => r.json()),
      fetch(`${apiBase}/api/spectate/history`).then((r) => r.json()),
    ])
      .then(([eventsData, historyData]) => {
        setInitialEvents(eventsData.events ?? []);

        // Convert TurnSnapshot[] → TurnHistoryEntry[]
        const entries: TurnHistoryEntry[] = (historyData.turns ?? []).map(
          (snap: TurnSnapshot) => ({
            turn: snap.turnNumber,
            players: computePlayerStatsFromSnapshot(snap),
          })
        );
        setInitialHistory(entries);
      })
      .catch(() => {
        // Silently fail if endpoints don't exist yet
      });
  }, []);

  return { initialEvents, initialHistory };
}
