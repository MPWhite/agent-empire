"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useGameSocket } from "@/lib/socket";
import { useHistoryMode } from "@/lib/useHistoryMode";
import { ReportEngine } from "@/lib/report-engine";
import { useTurnHistory } from "@/lib/useTurnHistory";
import type { AnalystReport } from "@/lib/types";
import GameMap from "@/components/GameMap";
import HistoryPlayer from "@/components/HistoryPlayer";
import { CommandBar } from "@/components/CommandBar";
import { SidePanel } from "@/components/SidePanel";
import { BreakingTicker } from "@/components/BreakingTicker";


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
  const turnHistory = useTurnHistory(gameState);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [hoveredTerritory, setHoveredTerritory] = useState<string | null>(null);
  const [reports, setReports] = useState<AnalystReport[]>([]);
  const [pendingTurns, setPendingTurns] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

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

  const hasTeamData = gameState.agentCounts !== undefined;

  // ── Game UI ──
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Unified Command Bar */}
      <CommandBar
        turnNumber={gameState.turnNumber}
        phase={gameState.phase}
        turnPhase={turnPhase}
        phaseEndsAt={phaseEndsAt}
        totalAgents={gameState.totalAgents ?? 0}
        hasTeamData={hasTeamData}
        connected={connected}
        historyActive={history.isActive}
        onToggleHistory={history.isActive ? history.closeTimeline : history.openTimeline}
        onNewGame={newGame}
      />

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

      {/* Main content: Map + Side Panel */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Map (dominant, fills all remaining space) */}
        <div className="flex-1 relative overflow-hidden">
          <GameMap
            gameState={displayState!}
            highlightPlayerId={selectedPlayerId}
            onTerritoryClick={handleTerritoryClick}
            onTerritoryHover={setHoveredTerritory}
            hoveredTerritory={hoveredTerritory}
            focusRegion={null}
          />
          {/* Breaking news ticker overlay */}
          <BreakingTicker reports={reports} />
        </div>

        {/* Side Panel: INTEL + COMMS tabs */}
        <SidePanel
          gameState={gameState}
          reports={reports}
          pendingTurns={pendingTurns}
          selectedPlayerId={selectedPlayerId}
          onPlayerClick={setSelectedPlayerId}
          onClosePlayer={() => setSelectedPlayerId(null)}
          onNewGame={newGame}
          hasTeamData={hasTeamData}
          turnHistory={turnHistory.getHistory()}
          deltas={turnHistory.deltas}
          teamChats={teamChats}
          teamProposals={teamProposals}
          agentCounts={gameState.agentCounts ?? {}}
          players={gameState.players}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          onMobileToggle={() => setMobileOpen(true)}
        />
      </div>
    </div>
  );
}
