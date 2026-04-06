"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useGameSocket } from "@/lib/socket";
import { useHistoryMode } from "@/lib/useHistoryMode";
import { ReportEngine } from "@/lib/report-engine";
import { useTurnHistory } from "@/lib/useTurnHistory";
import { useSpectatorInit } from "@/lib/useSpectatorInit";
import type { AnalystReport, MajorEvent } from "@/lib/types";
import GameMap from "@/components/GameMap";
import StoryRecap from "@/components/StoryRecap";
import MapAnimations from "@/components/MapAnimations";
import HistoryPlayer from "@/components/HistoryPlayer";
import { CommandBar } from "@/components/CommandBar";
import { SidePanel } from "@/components/SidePanel";
import { BreakingTicker } from "@/components/BreakingTicker";
import { MiniLeaderboard } from "@/components/MiniLeaderboard";
import { WhatIsThisModal, useWhatIsThisModal } from "@/components/WhatIsThisModal";


export default function Home() {
  const { initialEvents, initialHistory } = useSpectatorInit();

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
    narrative,
  } = useGameSocket(initialEvents);

  const history = useHistoryMode(sendMessage, onHistoryMeta, onTurnSnapshot, gameState);
  const turnHistory = useTurnHistory(gameState, initialHistory);

  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [hoveredTerritory, setHoveredTerritory] = useState<string | null>(null);
  const [reports, setReports] = useState<AnalystReport[]>([]);
  const [pendingTurns, setPendingTurns] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const whatIsThis = useWhatIsThisModal();

  // ── Story Recap ──
  const [showRecap, setShowRecap] = useState(false);
  const [recapData, setRecapData] = useState<{
    majorEvents: MajorEvent[];
    playerNames: Record<string, { name: string; color: string }>;
    currentSituation?: string;
  } | null>(null);

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
    setPendingTurns(turnNumber % 3);

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

  // Request history for recap when game loads
  const recapRequested = useRef(false);
  useEffect(() => {
    if (!gameState || recapRequested.current) return;
    recapRequested.current = true;

    onHistoryMeta((msg) => {
      if (msg.majorEvents.length > 0) {
        setRecapData({
          majorEvents: msg.majorEvents,
          playerNames: msg.playerNames,
          currentSituation: msg.currentSituation,
        });

        const dismissed = localStorage.getItem("agent-empires-recap-dismissed");
        if (!dismissed) {
          setShowRecap(true);
        }
      }
      onHistoryMeta(null);
    });

    sendMessage({ type: "request_history" });
  }, [gameState, onHistoryMeta, sendMessage]);

  const handleDismissRecap = useCallback(() => {
    setShowRecap(false);
    localStorage.setItem("agent-empires-recap-dismissed", "1");
  }, []);

  const handleShowRecap = useCallback(() => {
    setShowRecap(true);
  }, []);

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
      recapRequested.current = false;
      setRecapData(null);
      setShowRecap(false);
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

  // Compute player capitals (most troops) for map animations
  const playerCapitals = useMemo(() => {
    if (!gameState) return new Map<string, string>();
    const caps = new Map<string, string>();
    const maxTroops = new Map<string, number>();
    for (const t of Object.values(gameState.map.territories)) {
      if (!t.ownerId) continue;
      const current = maxTroops.get(t.ownerId) ?? 0;
      if (t.troops > current) {
        maxTroops.set(t.ownerId, t.troops);
        caps.set(t.ownerId, t.id);
      }
    }
    return caps;
  }, [gameState?.map.territories]);

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
      <WhatIsThisModal open={whatIsThis.open} onClose={whatIsThis.close} />

      {showRecap && recapData && (
        <StoryRecap
          majorEvents={recapData.majorEvents}
          playerNames={recapData.playerNames}
          currentSituation={recapData.currentSituation}
          currentTurn={gameState.turnNumber}
          onDismiss={handleDismissRecap}
        />
      )}

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
        onWhatIsThis={whatIsThis.show}
        onRecap={handleShowRecap}
        hasRecapData={recapData !== null}
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
          >
            <MapAnimations events={events} playerCapitals={playerCapitals} />
          </GameMap>
          {/* Breaking news ticker overlay */}
          <BreakingTicker
            reports={reports}
            events={events}
            players={gameState.players}
            territories={gameState.map.territories}
          />
          {/* Mini leaderboard when nothing selected and no hover tooltip */}
          {!selectedPlayerId && !hoveredTerritory && (
            <MiniLeaderboard
              gameState={gameState}
              onPlayerClick={setSelectedPlayerId}
            />
          )}
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
          events={events}
          narrative={narrative}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          onMobileToggle={() => setMobileOpen(true)}
        />
      </div>
    </div>
  );
}
