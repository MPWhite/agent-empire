"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type {
  ServerMessage,
  SerializedGameState,
  PlayerAction,
  GameEvent,
} from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001";

export interface GameConnection {
  gameState: SerializedGameState | null;
  events: GameEvent[];
  connected: boolean;
  turnEndedPlayers: Set<string>;
  submitActions: (playerId: string, actions: PlayerAction[]) => void;
  endTurn: (playerId: string) => void;
  newGame: () => void;
}

export function useGameSocket(): GameConnection {
  const wsRef = useRef<WebSocket | null>(null);

  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState<SerializedGameState | null>(null);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [turnEndedPlayers, setTurnEndedPlayers] = useState<Set<string>>(
    new Set()
  );

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
          setTurnEndedPlayers(new Set());
          break;
        case "turn_result":
          setGameState(msg.result.state);
          setEvents((prev) => [...prev, ...msg.result.events].slice(-200));
          setTurnEndedPlayers(new Set());
          break;
        case "player_turn_ended":
          setTurnEndedPlayers((prev) => new Set([...prev, msg.playerId]));
          break;
        case "actions_acknowledged":
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

  const submitActions = useCallback(
    (playerId: string, actions: PlayerAction[]) => {
      send({ type: "submit_actions", playerId, actions });
    },
    [send]
  );

  const endTurn = useCallback(
    (playerId: string) => {
      send({ type: "end_turn", playerId });
    },
    [send]
  );

  const newGame = useCallback(() => {
    setEvents([]);
    send({ type: "new_game" });
  }, [send]);

  return {
    gameState,
    events,
    connected,
    turnEndedPlayers,
    submitActions,
    endTurn,
    newGame,
  };
}
