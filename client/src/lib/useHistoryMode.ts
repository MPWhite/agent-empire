"use client";

import { useState, useCallback, useEffect } from "react";
import type {
  MajorEvent,
  SerializedGameState,
  HistoryMetaMessage,
  TurnSnapshotMessage,
} from "./types";

export interface HistoryMode {
  isActive: boolean;
  viewingTurn: number | null;
  majorEvents: MajorEvent[];
  totalTurns: number;
  historicalState: SerializedGameState | null;
  selectedEvent: MajorEvent | null;
  openTimeline: () => void;
  closeTimeline: () => void;
  goToTurn: (turnNumber: number) => void;
  selectEvent: (event: MajorEvent) => void;
  goToLive: () => void;
}

export function useHistoryMode(
  sendMessage: (data: unknown) => void,
  onHistoryMeta: (callback: ((msg: HistoryMetaMessage) => void) | null) => void,
  onTurnSnapshot: (callback: ((msg: TurnSnapshotMessage) => void) | null) => void,
  liveState: SerializedGameState | null,
): HistoryMode {
  const [isActive, setIsActive] = useState(false);
  const [majorEvents, setMajorEvents] = useState<MajorEvent[]>([]);
  const [totalTurns, setTotalTurns] = useState(0);
  const [viewingTurn, setViewingTurn] = useState<number | null>(null);
  const [historicalState, setHistoricalState] = useState<SerializedGameState | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<MajorEvent | null>(null);

  // Register message handlers
  useEffect(() => {
    onHistoryMeta((msg) => {
      setMajorEvents(msg.majorEvents);
      setTotalTurns(msg.totalTurns);
    });

    onTurnSnapshot((msg) => {
      if (!liveState) return;
      // Reconstruct full state by merging snapshot with live state's static map data
      const reconstructed: SerializedGameState = {
        map: {
          territories: { ...liveState.map.territories },
          continents: liveState.map.continents,
          adjacency: liveState.map.adjacency,
        },
        players: { ...liveState.players },
        turnNumber: msg.turnNumber,
        phase: 'playing',
      };

      // Overlay the snapshot's territory and player data
      for (const [tid, data] of Object.entries(msg.snapshot.territories)) {
        if (reconstructed.map.territories[tid]) {
          reconstructed.map.territories[tid] = {
            ...reconstructed.map.territories[tid],
            ownerId: data.ownerId,
            troops: data.troops,
          };
        }
      }

      for (const [pid, data] of Object.entries(msg.snapshot.players)) {
        if (reconstructed.players[pid]) {
          reconstructed.players[pid] = {
            ...reconstructed.players[pid],
            isAlive: data.isAlive,
          };
        }
      }

      setHistoricalState(reconstructed);
      setViewingTurn(msg.turnNumber);
    });

    return () => {
      onHistoryMeta(null);
      onTurnSnapshot(null);
    };
  }, [liveState, onHistoryMeta, onTurnSnapshot]);

  // Update totalTurns as live game progresses
  useEffect(() => {
    if (isActive && liveState) {
      setTotalTurns(liveState.turnNumber);
    }
  }, [isActive, liveState?.turnNumber]);

  const openTimeline = useCallback(() => {
    setIsActive(true);
    sendMessage({ type: "request_history" });
  }, [sendMessage]);

  const closeTimeline = useCallback(() => {
    setIsActive(false);
    setViewingTurn(null);
    setHistoricalState(null);
    setSelectedEvent(null);
  }, []);

  const goToTurn = useCallback(
    (turnNumber: number) => {
      sendMessage({ type: "request_turn", turnNumber });
    },
    [sendMessage],
  );

  const selectEvent = useCallback(
    (event: MajorEvent) => {
      setSelectedEvent(event);
      goToTurn(event.turnNumber);
    },
    [goToTurn],
  );

  const goToLive = useCallback(() => {
    setViewingTurn(null);
    setHistoricalState(null);
    setSelectedEvent(null);
  }, []);

  return {
    isActive,
    viewingTurn,
    majorEvents,
    totalTurns,
    historicalState,
    selectedEvent,
    openTimeline,
    closeTimeline,
    goToTurn,
    selectEvent,
    goToLive,
  };
}
