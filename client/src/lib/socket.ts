"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type {
  ServerMessage,
  SerializedGameState,
  SerializedTurnResult,
  PlayerAction,
  Player,
  GameEvent,
} from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";

export interface GameConnection {
  gameState: SerializedGameState | null;
  events: GameEvent[];
  secondsRemaining: number;
  connected: boolean;
  playerId: string | null;
  join: (playerId: string, name: string) => void;
  submitActions: (actions: PlayerAction[]) => void;
  startGame: () => void;
}

export function useGameSocket(): GameConnection {
  const wsRef = useRef<WebSocket | null>(null);
  const playerIdRef = useRef<string | null>(null);

  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<SerializedGameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [playerId, setPlayerId] = useState<string | null>(null);

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
          setEvents((prev) => [...prev, ...msg.result.events].slice(-200));
          break;
        case "timer_tick":
          setSecondsRemaining(msg.secondsRemaining);
          break;
        case "player_joined":
          setGameState((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              players: { ...prev.players, [msg.player.id]: msg.player },
            };
          });
          break;
        case "player_left":
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

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const join = useCallback(
    (id: string, name: string) => {
      playerIdRef.current = id;
      setPlayerId(id);
      send({ type: "join", playerId: id, name });
    },
    [send]
  );

  const submitActions = useCallback(
    (actions: PlayerAction[]) => {
      send({ type: "submit_actions", playerId: playerIdRef.current, actions });
    },
    [send]
  );

  const startGame = useCallback(() => {
    send({ type: "start_game", playerId: playerIdRef.current });
  }, [send]);

  return {
    gameState,
    events,
    secondsRemaining,
    connected,
    playerId,
    join,
    submitActions,
    startGame,
  };
}
