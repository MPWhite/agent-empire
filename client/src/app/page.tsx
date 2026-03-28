"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useGameSocket } from "@/lib/socket";
import { useHistoryMode } from "@/lib/useHistoryMode";
import { ReportEngine } from "@/lib/report-engine";
import type { AnalystReport } from "@/lib/types";
import GameMap from "@/components/GameMap";
import NewsFeed from "@/components/NewsFeed";
import HistoryPlayer from "@/components/HistoryPlayer";
import { TeamChatPanel } from "@/components/TeamChat";
import { PhaseTimer } from "@/components/PhaseTimer";

export default function Home() {
  const {
    gameState,
    events,
    connected,
    teamChats,
    teamProposals,
    turnPhase,
    phaseEndsAt,
    newGame,
    sendMessage,
    onHistoryMeta,
    onTurnSnapshot,
  } = useGameSocket();

  const history = useHistoryMode(sendMessage, onHistoryMeta, onTurnSnapshot, gameState);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [hoveredTerritory, setHoveredTerritory] = useState<string | null>(null);
  const [reports, setReports] = useState<AnalystReport[]>([]);
  const [pendingTurns, setPendingTurns] = useState(0);
  const [warDeskHeight, setWarDeskHeight] = useState(224);
  const isDragging = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const handleDragStart = useCallback((clientY: number) => {
    isDragging.current = true;
    dragStartY.current = clientY;
    dragStartHeight.current = warDeskHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, [warDeskHeight]);

  useEffect(() => {
    const handleMove = (clientY: number) => {
      if (!isDragging.current) return;
      const delta = dragStartY.current - clientY;
      const maxH = window.innerHeight * 0.6;
      setWarDeskHeight(Math.min(maxH, Math.max(80, dragStartHeight.current + delta)));
    };
    const handleEnd = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    const onMouseMove = (e: MouseEvent) => handleMove(e.clientY);
    const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientY);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", handleEnd);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", handleEnd);
    };
  }, []);

  // ── Report Engine ──
  const reportEngineRef = useRef(new ReportEngine(10));
  const processedEventsRef = useRef(0);
  const reportIdRef = useRef(0);

  useEffect(() => {
    if (!gameState || events.length <= processedEventsRef.current) return;

    const newEvents = events.slice(processedEventsRef.current);
    processedEventsRef.current = events.length;
    const turnNumber = gameState.turnNumber - 1;

    const trigger = reportEngineRef.current.addTurnEvents(newEvents, gameState, turnNumber);
    setPendingTurns(turnNumber % 10);

    if (!trigger) return;

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
        setReports((prev) =>
          prev.map((r) =>
            r.id === reportId ? { ...r, text: `[Report generation failed: ${res.status}]`, isStreaming: false } : r
          )
        );
        reportEngineRef.current.markGenerating(false);
        return;
      }

      if (mode === "dispatch" && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const current = accumulated;
          setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, text: current } : r)));
        }
        setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, isStreaming: false } : r)));
      } else {
        const data = await res.json();
        setReports((prev) =>
          prev.map((r) => (r.id === reportId ? { ...r, text: data.text, isStreaming: false } : r))
        );
      }
    } catch {
      setReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, text: "[Failed to generate report]", isStreaming: false } : r))
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

  const displayState =
    history.isActive && history.historicalState ? history.historicalState : gameState;

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
      <div className="flex-1 flex items-center justify-center h-screen">
        <div className="text-zinc-500 text-sm font-mono">
          {connected ? "LOADING GAME STATE..." : "CONNECTING TO SERVER..."}
        </div>
      </div>
    );
  }

  // Show team UI when connected to the new server (agentCounts field present)
  // or always show it since it's the primary spectator content
  const hasTeamData = gameState.agentCounts !== undefined;

  // ── Game UI ──
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Phase Timer (new: visible when team play is active) */}
      {hasTeamData && (
        <PhaseTimer
          turnNumber={gameState.turnNumber}
          turnPhase={turnPhase}
          phaseEndsAt={phaseEndsAt}
          totalAgents={gameState.totalAgents ?? 0}
        />
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-3 md:px-4 h-10 border-b border-zinc-800 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-2 md:gap-4">
          <h1 className="text-sm font-bold tracking-wide text-zinc-300 uppercase">
            Agent Empires
          </h1>
          <div className="hidden md:block w-px h-4 bg-zinc-800" />
          <span className="text-zinc-500 text-xs font-mono">T{gameState.turnNumber}</span>
          {!hasTeamData && (
            <span className="hidden md:inline text-zinc-600 text-xs font-mono">
              PHASE: {gameState.phase.toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
            <span className="hidden md:inline text-xs font-mono text-zinc-600 uppercase">
              {connected ? "Live" : "Disconnected"}
            </span>
          </div>
          <div className="hidden md:block w-px h-4 bg-zinc-800" />
          <button
            onClick={history.isActive ? history.closeTimeline : history.openTimeline}
            className={`text-xs font-mono px-1.5 py-0.5 md:px-2 md:py-1 border transition-colors ${
              history.isActive
                ? "text-amber-400 border-amber-800 hover:border-amber-700"
                : "text-zinc-600 hover:text-zinc-400 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            {history.isActive ? "CLOSE" : "HISTORY"}
          </button>
          <button
            onClick={newGame}
            className="text-zinc-600 hover:text-zinc-400 text-xs font-mono px-1.5 py-0.5 md:px-2 md:py-1 border border-zinc-800 hover:border-zinc-700 transition-colors"
          >
            NEW
          </button>
        </div>
      </header>

      {/* History player overlay */}
      {history.isActive && (
        <HistoryPlayer
          totalTurns={history.totalTurns}
          currentLiveTurn={gameState.turnNumber}
          viewingTurn={history.viewingTurn}
          onGoToTurn={history.goToTurn}
          onGoToLive={history.goToLive}
          onClose={history.closeTimeline}
        />
      )}

      {/* Main content: Chat | Map | War Desk */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Team Chat panel (left, visible when team play active) */}
        {hasTeamData && (
          <div className="lg:w-[380px] xl:w-[440px] h-48 lg:h-auto shrink-0 border-b lg:border-b-0 lg:border-r border-zinc-800">
            <TeamChatPanel
              players={gameState.players}
              teamChats={teamChats}
              teamProposals={teamProposals}
              agentCounts={gameState.agentCounts ?? {}}
            />
          </div>
        )}

        {/* Center: Map + War Desk */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Map */}
          <div className="flex-1 relative overflow-hidden">
            <GameMap
              gameState={displayState!}
              highlightPlayerId={selectedPlayerId}
              onTerritoryClick={handleTerritoryClick}
              onTerritoryHover={setHoveredTerritory}
              hoveredTerritory={hoveredTerritory}
              focusRegion={null}
            />
          </div>

          {/* War Desk (bottom, resizable) */}
          <div className="shrink-0 border-t border-zinc-800 overflow-hidden flex flex-col" style={{ height: warDeskHeight }}>
            {/* Drag handle */}
            <div
              className="flex items-center justify-center h-2 cursor-row-resize group"
              onMouseDown={(e) => handleDragStart(e.clientY)}
              onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
            >
              <div className="w-8 h-0.5 rounded-full bg-zinc-700 group-hover:bg-zinc-500 group-active:bg-zinc-400 transition-colors" />
            </div>
            {gameState.phase === "finished" && !selectedPlayerId ? (
              <div className="flex items-center justify-center gap-4 h-full">
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
              <NewsFeed
                reports={reports}
                gameState={gameState}
                onPlayerClick={setSelectedPlayerId}
                selectedPlayerId={selectedPlayerId}
                currentTurn={gameState.turnNumber}
                pendingTurns={pendingTurns}
                onClosePlayer={() => setSelectedPlayerId(null)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
