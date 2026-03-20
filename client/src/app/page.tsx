"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { useGameSocket } from "@/lib/socket";
import type { PlayerAction } from "@/lib/types";
import GameMap from "@/components/GameMap";
import TurnTimer from "@/components/TurnTimer";
import PlayerList from "@/components/PlayerList";
import ActionQueue from "@/components/ActionQueue";
import ActionPanel from "@/components/ActionPanel";
import EventLog from "@/components/EventLog";

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export default function Home() {
  const {
    gameState,
    events,
    secondsRemaining,
    connected,
    playerId,
    join,
    submitActions,
    startGame,
  } = useGameSocket();

  const [nameInput, setNameInput] = useState("");
  const [actions, setActions] = useState<PlayerAction[]>([]);
  const [selectedTerritory, setSelectedTerritory] = useState<string | null>(null);
  const [targetTerritory, setTargetTerritory] = useState<string | null>(null);
  const [hoveredTerritory, setHoveredTerritory] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Auto-submit actions when turn ends (timer reaches 0)
  useEffect(() => {
    if (secondsRemaining === 0 && actions.length > 0 && !submitted) {
      submitActions(actions);
      setSubmitted(true);
    }
  }, [secondsRemaining, actions, submitted, submitActions]);

  // Reset submitted flag and actions on new turn
  useEffect(() => {
    if (secondsRemaining > 50) {
      setSubmitted(false);
      setActions([]);
    }
  }, [secondsRemaining]);

  // Compute targetable territories based on selection
  const targetableTerritories = useMemo(() => {
    const targets = new Set<string>();
    if (!selectedTerritory || !gameState || !playerId) return targets;

    const territory = gameState.map.territories[selectedTerritory];
    if (territory?.ownerId !== playerId) return targets;

    const neighbors = gameState.map.adjacency[selectedTerritory] ?? [];
    for (const nid of neighbors) {
      const neighbor = gameState.map.territories[nid];
      if (neighbor && neighbor.ownerId !== playerId && neighbor.ownerId !== null) {
        targets.add(nid);
      }
    }
    return targets;
  }, [selectedTerritory, gameState, playerId]);

  const handleTerritoryClick = useCallback(
    (territoryId: string) => {
      if (!gameState || !playerId) return;

      const territory = gameState.map.territories[territoryId];
      if (!territory) return;

      // If we have a selection and click a targetable territory, set it as target
      if (selectedTerritory && targetableTerritories.has(territoryId)) {
        setTargetTerritory(territoryId);
        return;
      }

      // Otherwise, select the clicked territory
      setSelectedTerritory(territoryId);
      setTargetTerritory(null);
    },
    [gameState, playerId, selectedTerritory, targetableTerritories]
  );

  const handleAddAction = useCallback((action: PlayerAction) => {
    setActions((prev) => [...prev, action]);
  }, []);

  const handleRemoveAction = useCallback((index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedTerritory(null);
    setTargetTerritory(null);
  }, []);

  const handleSubmitActions = useCallback(() => {
    submitActions(actions);
    setSubmitted(true);
    setSelectedTerritory(null);
    setTargetTerritory(null);
  }, [actions, submitActions]);

  const handleClearActions = useCallback(() => {
    setActions([]);
    setSubmitted(false);
  }, []);

  const handleJoin = useCallback(() => {
    if (!nameInput.trim()) return;
    join(generateId(), nameInput.trim());
  }, [nameInput, join]);

  // ── Pre-join screen ──
  if (!playerId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-white border border-zinc-200 rounded-xl p-8 w-80 shadow-sm">
          <h1 className="text-2xl font-bold mb-1">Risk MMO</h1>
          <p className="text-zinc-500 text-sm mb-6">
            {connected ? "Connected to server" : "Connecting..."}
          </p>
          <input
            type="text"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="Your name"
            className="w-full bg-zinc-50 border border-zinc-300 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-zinc-400"
            autoFocus
          />
          <button
            onClick={handleJoin}
            disabled={!connected || !nameInput.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Join Game
          </button>
        </div>
      </div>
    );
  }

  // ── Waiting for game to start ──
  if (!gameState || gameState.phase === "waiting") {
    const playerCount = gameState ? Object.keys(gameState.players).length : 0;

    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="bg-white border border-zinc-200 rounded-xl p-8 w-96 text-center shadow-sm">
          <h1 className="text-2xl font-bold mb-2">Risk MMO</h1>
          <p className="text-zinc-500 mb-4">
            Waiting for players... ({playerCount} connected)
          </p>
          {gameState && (
            <div className="mb-4 text-left">
              {Object.values(gameState.players).map((p) => (
                <div key={p.id} className="flex items-center gap-2 py-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="text-sm">{p.name}</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={startGame}
            disabled={playerCount < 2}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            {playerCount < 2 ? "Need 2+ players" : "Start Game"}
          </button>
        </div>
      </div>
    );
  }

  // ── Game UI ──
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-zinc-200">
        <h1 className="text-lg font-bold">Risk MMO</h1>
        <TurnTimer
          secondsRemaining={secondsRemaining}
          turnNumber={gameState.turnNumber}
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleSubmitActions}
            disabled={actions.length === 0 || submitted}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-sm font-medium py-1.5 px-4 rounded transition-colors"
          >
            {submitted ? "Submitted" : `Submit (${actions.length})`}
          </button>
          {actions.length > 0 && !submitted && (
            <button
              onClick={handleClearActions}
              className="text-zinc-400 hover:text-zinc-600 text-sm px-2"
            >
              Clear
            </button>
          )}
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
          <PlayerList gameState={gameState} currentPlayerId={playerId} />
          <ActionPanel
            gameState={gameState}
            playerId={playerId}
            selectedTerritory={selectedTerritory}
            targetTerritory={targetTerritory}
            onAddAction={handleAddAction}
            onClearSelection={handleClearSelection}
          />
          <ActionQueue
            actions={actions}
            gameState={gameState}
            onRemoveAction={handleRemoveAction}
          />
          <EventLog events={events} gameState={gameState} />

          {gameState.phase === "finished" && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 text-center">
              <div className="text-amber-700 font-bold text-lg">Game Over!</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
