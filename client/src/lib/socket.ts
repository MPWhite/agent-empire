"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type {
  ServerMessage,
  SerializedGameState,
  GameEvent,
  ChatMessage,
  Proposal,
  TurnPhase,
  HistoryMetaMessage,
  TurnSnapshotMessage,
  TurnHistoryMessage,
  TurnNarrative,
} from "./types";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3001/ws";

export interface GameConnection {
  gameState: SerializedGameState | null;
  events: GameEvent[];
  connected: boolean;
  // Team chats: teamId → messages
  teamChats: Record<string, ChatMessage[]>;
  // Proposals: teamId → proposals (with vote counts)
  teamProposals: Record<string, Proposal[]>;
  // Current turn phase
  turnPhase: TurnPhase | null;
  phaseEndsAt: string | null;
  narrative: TurnNarrative | null;
  initialTurnHistory: TurnHistoryMessage['turns'] | null;
  // Actions
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
  const [teamChats, setTeamChats] = useState<Record<string, ChatMessage[]>>({});
  const [teamProposals, setTeamProposals] = useState<Record<string, Proposal[]>>({});
  const [turnPhase, setTurnPhase] = useState<TurnPhase | null>(null);
  const [phaseEndsAt, setPhaseEndsAt] = useState<string | null>(null);
  const [narrative, setNarrative] = useState<TurnNarrative | null>(null);
  const [initialTurnHistory, setInitialTurnHistory] = useState<TurnHistoryMessage['turns'] | null>(null);

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
          if (msg.state.turnPhase) setTurnPhase(msg.state.turnPhase);
          if (msg.state.phaseEndsAt) setPhaseEndsAt(msg.state.phaseEndsAt);
          break;
        case "turn_result":
          setGameState(msg.result.state);
          setEvents((prev) => [...prev, ...msg.result.events].slice(-500));
          // Clear proposals on turn resolution
          setTeamProposals({});
          if (msg.result.narrative) {
            setNarrative(msg.result.narrative);
          }
          break;
        case "chat_message":
          setTeamChats((prev) => {
            const teamId = msg.message.teamId;
            const existing = prev[teamId] ?? [];
            return { ...prev, [teamId]: [...existing, msg.message].slice(-200) };
          });
          break;
        case "phase_change":
          setTurnPhase(msg.phase);
          setPhaseEndsAt(msg.phaseEndsAt);
          break;
        case "proposal_update":
        case "vote_update":
          setTeamProposals((prev) => ({
            ...prev,
            [msg.teamId]: msg.proposals,
          }));
          break;
        case "history_meta":
          historyMetaCallback.current?.(msg);
          break;
        case "turn_snapshot":
          turnSnapshotCallback.current?.(msg);
          break;
        case "turn_history":
          setInitialTurnHistory(msg.turns);
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
    setTeamChats({});
    setTeamProposals({});
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
    teamChats,
    teamProposals,
    turnPhase,
    phaseEndsAt,
    narrative,
    initialTurnHistory,
    newGame,
    sendMessage,
    onHistoryMeta,
    onTurnSnapshot,
  };
}
