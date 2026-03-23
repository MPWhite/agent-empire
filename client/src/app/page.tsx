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

  const activePlayerId = "p1";
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
  }, [activePlayerId, currentActions, submitActions, endTurn]);

  const handleClearActions = useCallback(() => {
    setActions((prev) => ({
      ...prev,
      [activePlayerId]: [],
    }));
  }, [activePlayerId]);

  // ── Loading state ──
  if (!gameState) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-zinc-500 text-sm font-mono">
          {connected ? "LOADING GAME STATE..." : "CONNECTING TO SERVER..."}
        </div>
      </div>
    );
  }

  // Count territories for header stats
  const playerTerritories = Object.values(gameState.map.territories).filter(
    (t) => t.ownerId === activePlayerId
  ).length;
  const playerTroops = Object.values(gameState.map.territories)
    .filter((t) => t.ownerId === activePlayerId)
    .reduce((sum, t) => sum + t.troops, 0);

  // ── Game UI ──
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header bar */}
      <header className="flex items-center justify-between px-4 h-10 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-bold tracking-wide text-zinc-300 uppercase">
            Agent Empires
          </h1>
          <div className="w-px h-4 bg-zinc-800" />
          <span className="text-zinc-500 text-xs font-mono">
            TURN {gameState.turnNumber}
          </span>
          <span className="text-zinc-600 text-xs font-mono">
            PHASE: {gameState.phase.toUpperCase()}
          </span>
        </div>

        {/* Player + stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-xs font-mono text-zinc-500">
            <span>{playerTerritories} TERR</span>
            <span>{playerTroops} TROOPS</span>
          </div>
          <div className="w-px h-4 bg-zinc-800" />
          <div className="flex items-center gap-1.5">
            <div
              className="w-2 h-2"
              style={{ backgroundColor: gameState.players["p1"]?.color }}
            />
            <span className="text-xs font-medium text-zinc-400">YOU</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {gameState.phase === "playing" && (
            <button
              onClick={handleEndTurn}
              disabled={hasEndedTurn}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-xs font-mono font-medium py-1 px-3 transition-colors"
            >
              {hasEndedTurn
                ? "WAITING..."
                : `END TURN (${currentActions.length})`}
            </button>
          )}
          {currentActions.length > 0 && !hasEndedTurn && (
            <button
              onClick={handleClearActions}
              className="text-zinc-500 hover:text-zinc-300 text-xs font-mono px-2"
            >
              CLEAR
            </button>
          )}
          <button
            onClick={newGame}
            className="text-zinc-600 hover:text-zinc-400 text-xs font-mono px-2 py-1 border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            NEW GAME
          </button>
        </div>
      </header>

      {/* Map — full width, takes remaining vertical space */}
      <div className="flex-1 relative overflow-hidden">
        <GameMap
          gameState={gameState}
          selectedTerritory={selectedTerritory}
          targetableTerritories={targetableTerritories}
          onTerritoryClick={handleTerritoryClick}
          onTerritoryHover={setHoveredTerritory}
          hoveredTerritory={hoveredTerritory}
        />

        {/* Connection status indicator */}
        <div className="absolute top-2 left-2 flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 ${
              connected ? "bg-emerald-500" : "bg-red-500"
            }`}
          />
          <span className="text-[10px] font-mono text-zinc-600 uppercase">
            {connected ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Bottom control panels */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-950">
        {gameState.phase === "finished" ? (
          <div className="flex items-center justify-center gap-4 py-4">
            <span className="text-amber-500 font-mono font-bold text-sm uppercase tracking-wider">
              Game Over
            </span>
            <button
              onClick={newGame}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium py-1.5 px-4 transition-colors"
            >
              NEW GAME
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 divide-x divide-zinc-800 h-80">
            <div className="overflow-y-auto panel-scroll">
              <PlayerList
                gameState={gameState}
                currentPlayerId={activePlayerId}
              />
            </div>
            <div className="overflow-y-auto panel-scroll">
              {gameState.phase === "playing" && !hasEndedTurn ? (
                <ActionPanel
                  gameState={gameState}
                  playerId={activePlayerId}
                  selectedTerritory={selectedTerritory}
                  targetTerritory={targetTerritory}
                  onAddAction={handleAddAction}
                  onClearSelection={handleClearSelection}
                />
              ) : (
                <div className="p-3">
                  <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2 font-mono">
                    Actions
                  </h3>
                  <p className="text-zinc-600 text-xs font-mono">
                    {hasEndedTurn ? "WAITING FOR OTHER PLAYERS..." : "NO ACTIONS AVAILABLE"}
                  </p>
                </div>
              )}
            </div>
            <div className="overflow-y-auto panel-scroll">
              <ActionQueue
                actions={currentActions}
                gameState={gameState}
                onRemoveAction={handleRemoveAction}
              />
            </div>
            <div className="overflow-y-auto panel-scroll">
              <EventLog events={events} gameState={gameState} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
