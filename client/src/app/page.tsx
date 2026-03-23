"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useGameSocket } from "@/lib/socket";
import type { PlayerAction } from "@/lib/types";
import GameMap from "@/components/GameMap";
import PlayerList from "@/components/PlayerList";
import ActionQueue from "@/components/ActionQueue";
import ActionPanel from "@/components/ActionPanel";
import EventLog from "@/components/EventLog";

export default function Home() {
  const {
    gameState,
    events,
    connected,
    turnEndedPlayers,
    submitActions,
    endTurn,
    newGame,
  } = useGameSocket();

  const [activePlayerId, setActivePlayerId] = useState("p1");
  const [actions, setActions] = useState<Record<string, PlayerAction[]>>({});
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(
    null
  );
  const [targetTerritory, setTargetTerritory] = useState<string | null>(null);
  const [hoveredTerritory, setHoveredTerritory] = useState<string | null>(null);

  const currentActions = actions[activePlayerId] ?? [];
  const hasEndedTurn = turnEndedPlayers.has(activePlayerId);

  // Reset actions when turn resolves (turnEndedPlayers clears)
  const prevTurnRef = useRef(gameState?.turnNumber);
  useEffect(() => {
    if (gameState && gameState.turnNumber !== prevTurnRef.current) {
      prevTurnRef.current = gameState.turnNumber;
      setActions({});
      setSelectedTerritory(null);
      setTargetTerritory(null);
    }
  }, [gameState?.turnNumber, gameState]);

  // Compute targetable territories based on selection
  const targetableTerritories = useMemo(() => {
    const targets = new Set<string>();
    if (!selectedTerritory || !gameState) return targets;

    const territory = gameState.map.territories[selectedTerritory];
    if (territory?.ownerId !== activePlayerId) return targets;

    const neighbors = gameState.map.adjacency[selectedTerritory] ?? [];
    for (const nid of neighbors) {
      const neighbor = gameState.map.territories[nid];
      if (neighbor && neighbor.ownerId !== activePlayerId && neighbor.ownerId !== null) {
        targets.add(nid);
      }
    }
    return targets;
  }, [selectedTerritory, gameState, activePlayerId]);

  const handleTerritoryClick = useCallback(
    (territoryId: string) => {
      if (!gameState) return;

      const territory = gameState.map.territories[territoryId];
      if (!territory) return;

      if (selectedTerritory && targetableTerritories.has(territoryId)) {
        setTargetTerritory(territoryId);
        return;
      }

      setSelectedTerritory(territoryId);
      setTargetTerritory(null);
    },
    [gameState, selectedTerritory, targetableTerritories]
  );

  const handleAddAction = useCallback(
    (action: PlayerAction) => {
      setActions((prev) => ({
        ...prev,
        [activePlayerId]: [...(prev[activePlayerId] ?? []), action],
      }));
    },
    [activePlayerId]
  );

  const handleRemoveAction = useCallback(
    (index: number) => {
      setActions((prev) => ({
        ...prev,
        [activePlayerId]: (prev[activePlayerId] ?? []).filter(
          (_, i) => i !== index
        ),
      }));
    },
    [activePlayerId]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedTerritory(null);
    setTargetTerritory(null);
  }, []);

  const handleEndTurn = useCallback(() => {
    submitActions(activePlayerId, currentActions);
    endTurn(activePlayerId);
    setSelectedTerritory(null);
    setTargetTerritory(null);

    // Auto-switch to the next player who hasn't ended their turn
    if (gameState) {
      const playerIds = Object.keys(gameState.players);
      const currentIdx = playerIds.indexOf(activePlayerId);
      for (let offset = 1; offset < playerIds.length; offset++) {
        const nextId = playerIds[(currentIdx + offset) % playerIds.length];
        if (!turnEndedPlayers.has(nextId)) {
          setActivePlayerId(nextId);
          break;
        }
      }
    }
  }, [activePlayerId, currentActions, submitActions, endTurn, turnEndedPlayers]);

  const handleClearActions = useCallback(() => {
    setActions((prev) => ({
      ...prev,
      [activePlayerId]: [],
    }));
  }, [activePlayerId]);

  const handleSwitchPlayer = useCallback((playerId: string) => {
    setActivePlayerId(playerId);
    setSelectedTerritory(null);
    setTargetTerritory(null);
  }, []);

  // ── Loading state ──
  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-zinc-400 text-sm">
          {connected ? "Loading game..." : "Connecting to server..."}
        </div>
      </div>
    );
  }

  const players = Object.values(gameState.players);

  // ── Game UI ──
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-200">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold">Risk MMO</h1>
          <span className="text-zinc-400 text-sm font-mono">
            Turn {gameState.turnNumber}
          </span>
        </div>

        {/* Player switcher */}
        <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
          {players.map((player) => {
            const isActive = player.id === activePlayerId;
            const hasEnded = turnEndedPlayers.has(player.id);
            return (
              <button
                key={player.id}
                onClick={() => handleSwitchPlayer(player.id)}
                disabled={hasEnded}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white shadow-sm text-zinc-900"
                    : hasEnded
                      ? "text-zinc-300 cursor-not-allowed"
                      : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: player.color }}
                />
                {player.name}
                {hasEnded && (
                  <span className="text-xs text-zinc-400">done</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {gameState.phase === "playing" && (
            <button
              onClick={handleEndTurn}
              disabled={hasEndedTurn}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-sm font-medium py-1.5 px-4 rounded transition-colors"
            >
              {hasEndedTurn
                ? "Waiting..."
                : `End Turn (${currentActions.length})`}
            </button>
          )}
          {currentActions.length > 0 && !hasEndedTurn && (
            <button
              onClick={handleClearActions}
              className="text-zinc-400 hover:text-zinc-600 text-sm px-2"
            >
              Clear
            </button>
          )}
          <button
            onClick={newGame}
            className="text-zinc-400 hover:text-zinc-600 text-xs px-2 py-1 border border-zinc-200 rounded"
          >
            New Game
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map area */}
        <div className="flex-1 p-2 overflow-auto">
          <GameMap
            gameState={gameState}
            selectedTerritory={selectedTerritory}
            targetableTerritories={targetableTerritories}
            onTerritoryClick={handleTerritoryClick}
            onTerritoryHover={setHoveredTerritory}
            hoveredTerritory={hoveredTerritory}
          />
        </div>

        {/* Sidebar */}
        <aside className="w-72 border-l border-zinc-200 p-3 flex flex-col gap-3 overflow-y-auto">
          <PlayerList
            gameState={gameState}
            currentPlayerId={activePlayerId}
          />
          {gameState.phase === "playing" && !hasEndedTurn && (
            <>
              <ActionPanel
                gameState={gameState}
                playerId={activePlayerId}
                selectedTerritory={selectedTerritory}
                targetTerritory={targetTerritory}
                onAddAction={handleAddAction}
                onClearSelection={handleClearSelection}
              />
              <ActionQueue
                actions={currentActions}
                gameState={gameState}
                onRemoveAction={handleRemoveAction}
              />
            </>
          )}
          <EventLog events={events} gameState={gameState} />

          {gameState.phase === "finished" && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-center">
              <div className="text-amber-700 font-bold text-lg">
                Game Over!
              </div>
              <button
                onClick={newGame}
                className="mt-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-1.5 px-4 rounded transition-colors"
              >
                New Game
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
