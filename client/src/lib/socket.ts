"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type {
  ServerMessage,
  SerializedGameState,
  GameEvent,
  HistoryMetaMessage,
  TurnSnapshotMessage,
} from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";

export interface GameConnection {
  gameState: SerializedGameState | null;
  events: GameEvent[];
  connected: boolean;
  newGame: () => void;
  sendMessage: (data: unknown) => void;
  onHistoryMeta: (callback: ((msg: HistoryMetaMessage) => void) | null) => void;
  onTurnSnapshot: (callback: ((msg: TurnSnapshotMessage) => void) | null) => void;
}

export function useGameSocket(): GameConnection {
  const wsRef = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<SerializedGameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);

  const historyMetaCallback = useRef<((msg: HistoryMetaMessage) => void) | null>(null);
  const turnSnapshotCallback = useRef<((msg: TurnSnapshotMessage) => void) | null>(null);

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    ws.onmessage = (event) => {
      const msg: ServerMessage = JSON.parse(event.data);

      switch (msg.type) {
        case "game_state":
          setGameState(msg.state);
          break;
        case "turn_result":
          setGameState(msg.result.state);
          setEvents((prev) => [...prev, ...msg.result.events].slice(-500));
          break;
        case "history_meta":
          historyMetaCallback.current?.(msg);
          break;
        case "turn_snapshot":
          turnSnapshotCallback.current?.(msg);
          break;
        case "error":
          console.error("Server error:", msg.message);
          break;
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const sendMessage = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const newGame = useCallback(() => {
    setEvents([]);
    sendMessage({ type: "new_game" });
  }, [sendMessage]);

  const onHistoryMeta = useCallback((callback: ((msg: HistoryMetaMessage) => void) | null) => {
    historyMetaCallback.current = callback;
  }, []);

  const onTurnSnapshot = useCallback((callback: ((msg: TurnSnapshotMessage) => void) | null) => {
    turnSnapshotCallback.current = callback;
  }, []);

  return {
    gameState,
    events,
    connected,
    newGame,
    sendMessage,
    onHistoryMeta,
    onTurnSnapshot,
  };
}
