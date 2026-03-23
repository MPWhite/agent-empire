"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useGameSocket } from "@/lib/socket";
import { generateHeadlines, type Headline } from "@/lib/headlines";
import GameMap from "@/components/GameMap";
import NewsFeed from "@/components/NewsFeed";
import PlayerDetail from "@/components/PlayerDetail";

export default function Home() {
  const { gameState, events, connected, newGame } = useGameSocket();

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [hoveredTerritory, setHoveredTerritory] = useState<string | null>(null);
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const processedEventsRef = useRef(0);

  // Generate headlines from new events
  useEffect(() => {
    if (!gameState || events.length <= processedEventsRef.current) return;

    const newEvents = events.slice(processedEventsRef.current);
    const newHeadlines = generateHeadlines(
      newEvents,
      gameState,
      gameState.turnNumber - 1
    );
    processedEventsRef.current = events.length;

    if (newHeadlines.length > 0) {
      setHeadlines((prev) => [...prev, ...newHeadlines].slice(-500));
    }
  }, [events, gameState]);

  // Reset headlines on new game
  const prevTurnRef = useRef(gameState?.turnNumber);
  useEffect(() => {
    if (gameState && gameState.turnNumber === 1 && prevTurnRef.current !== 1) {
      setHeadlines([]);
      processedEventsRef.current = 0;
      setSelectedPlayerId(null);
    }
    prevTurnRef.current = gameState?.turnNumber;
  }, [gameState?.turnNumber, gameState]);

  const handleTerritoryClick = useCallback(
    (territoryId: string) => {
      if (!gameState) return;
      const territory = gameState.map.territories[territoryId];
      if (territory?.ownerId) {
        setSelectedPlayerId(territory.ownerId);
      }
    },
    [gameState]
  );

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

        <div className="flex items-center gap-3">
          {/* Connection indicator */}
          <div className="flex items-center gap-1.5">
            <div
              className={`w-1.5 h-1.5 ${
                connected ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
            <span className="text-[10px] font-mono text-zinc-600 uppercase">
              {connected ? "Live" : "Disconnected"}
            </span>
          </div>
          <div className="w-px h-4 bg-zinc-800" />
          <span className="text-[10px] font-mono text-zinc-600">
            AUTO 2s/turn
          </span>
          <div className="w-px h-4 bg-zinc-800" />
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
          highlightPlayerId={selectedPlayerId}
          onTerritoryClick={handleTerritoryClick}
          onTerritoryHover={setHoveredTerritory}
          hoveredTerritory={hoveredTerritory}
        />
      </div>

      {/* Bottom panel — news feed or player detail */}
      <div className="shrink-0 border-t border-zinc-800 bg-zinc-950">
        {gameState.phase === "finished" && !selectedPlayerId ? (
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
        ) : selectedPlayerId ? (
          <PlayerDetail
            playerId={selectedPlayerId}
            gameState={gameState}
            headlines={headlines}
            onClose={() => setSelectedPlayerId(null)}
          />
        ) : (
          <NewsFeed
            headlines={headlines}
            gameState={gameState}
            onPlayerClick={setSelectedPlayerId}
            selectedPlayerId={selectedPlayerId}
          />
        )}
      </div>
    </div>
  );
}
