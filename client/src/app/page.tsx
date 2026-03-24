"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useGameSocket } from "@/lib/socket";
import { ReportEngine } from "@/lib/report-engine";
import type { AnalystReport } from "@/lib/types";
import GameMap from "@/components/GameMap";
import NewsFeed from "@/components/NewsFeed";
import PlayerDetail from "@/components/PlayerDetail";

export default function Home() {
  const { gameState, events, connected, newGame } = useGameSocket();

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [hoveredTerritory, setHoveredTerritory] = useState<string | null>(null);
  const [reports, setReports] = useState<AnalystReport[]>([]);
  const [pendingTurns, setPendingTurns] = useState(0);

  const reportEngineRef = useRef(new ReportEngine(10));
  const processedEventsRef = useRef(0);
  const reportIdRef = useRef(0);

  // Process new events through the report engine
  useEffect(() => {
    if (!gameState || events.length <= processedEventsRef.current) return;

    const newEvents = events.slice(processedEventsRef.current);
    processedEventsRef.current = events.length;
    const turnNumber = gameState.turnNumber - 1;

    const trigger = reportEngineRef.current.addTurnEvents(
      newEvents,
      gameState,
      turnNumber
    );

    // Track pending turns for UI
    setPendingTurns(turnNumber % 10);

    if (!trigger) return;

    // Generate report
    const reportId = `report-${++reportIdRef.current}`;
    const newReport: AnalystReport = {
      id: reportId,
      type: trigger.mode,
      turnRange: trigger.turnRange,
      text: "",
      isStreaming: true,
      timestamp: Date.now(),
    };

    setReports((prev) => [...prev, newReport].slice(-50));
    reportEngineRef.current.markGenerating(true);

    // Call the API
    fetchReport(trigger.mode, trigger.events, trigger.state, trigger.turnRange, reportId);
  }, [events, gameState]);

  async function fetchReport(
    mode: "dispatch" | "breaking",
    triggerEvents: import("@/lib/types").GameEvent[],
    state: import("@/lib/types").SerializedGameState,
    turnRange: [number, number],
    reportId: string
  ) {
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, events: triggerEvents, state, turnRange }),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.error("Report API error:", res.status, errText);
        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId
              ? { ...r, text: `[Report generation failed: ${res.status}]`, isStreaming: false }
              : r
          )
        );
        reportEngineRef.current.markGenerating(false);
        return;
      }

      if (mode === "dispatch" && res.body) {
        // Stream the response
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const current = accumulated;
          setReports((prev) =>
            prev.map((r) =>
              r.id === reportId ? { ...r, text: current } : r
            )
          );
        }

        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId ? { ...r, isStreaming: false } : r
          )
        );
      } else {
        // Breaking: JSON response
        const data = await res.json();
        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId
              ? { ...r, text: data.text, isStreaming: false }
              : r
          )
        );
      }
    } catch (err) {
      console.error("Report fetch error:", err);
      setReports((prev) =>
        prev.map((r) =>
          r.id === reportId
            ? { ...r, text: "[Failed to generate report]", isStreaming: false }
            : r
        )
      );
    } finally {
      reportEngineRef.current.markGenerating(false);
    }
  }

  // Reset on new game
  const prevTurnRef = useRef(gameState?.turnNumber);
  useEffect(() => {
    if (gameState && gameState.turnNumber === 1 && prevTurnRef.current !== 1) {
      setReports([]);
      processedEventsRef.current = 0;
      reportIdRef.current = 0;
      reportEngineRef.current.reset();
      setSelectedPlayerId(null);
      setPendingTurns(0);
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
            reports={reports}
            onClose={() => setSelectedPlayerId(null)}
          />
        ) : (
          <NewsFeed
            reports={reports}
            gameState={gameState}
            onPlayerClick={setSelectedPlayerId}
            selectedPlayerId={selectedPlayerId}
            currentTurn={gameState.turnNumber}
            pendingTurns={pendingTurns}
          />
        )}
      </div>
    </div>
  );
}
