"use client";

import { useEffect, useState, useRef } from "react";
import type { AnalystReport, GameEvent, Player, NukeEvent, ResearchEvent } from "@/lib/types";

interface BreakingTickerProps {
  reports: AnalystReport[];
  onClickReport?: () => void;
  events?: GameEvent[];
  players?: Record<string, Player>;
  territories?: Record<string, { name: string }>;
}

export function BreakingTicker({ reports, onClickReport, events = [], players = {}, territories = {} }: BreakingTickerProps) {
  const [visible, setVisible] = useState(false);
  const [currentReport, setCurrentReport] = useState<AnalystReport | null>(null);
  const lastSeenId = useRef<string | null>(null);
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const breaking = reports.filter((r) => r.type === "breaking");
    if (breaking.length === 0) return;

    const latest = breaking[breaking.length - 1];
    if (latest.id === lastSeenId.current) return;

    lastSeenId.current = latest.id;
    setCurrentReport(latest);
    setVisible(true);

    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      setVisible(false);
    }, 8000);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [reports]);

  // Generate breaking headlines from dramatic game events
  const lastEventIndex = useRef(0);
  useEffect(() => {
    if (events.length <= lastEventIndex.current) return;
    const newEvents = events.slice(lastEventIndex.current);
    lastEventIndex.current = events.length;

    for (const evt of newEvents) {
      let headline = '';
      if (evt.type === 'nuke') {
        const e = evt as NukeEvent;
        const attacker = players[e.attackerId]?.name ?? e.attackerId;
        const target = territories[e.targetTerritoryId]?.name ?? e.targetTerritoryId;
        headline = `☢️ ${attacker} launched a nuclear strike on ${target}!`;
        if (e.retaliations.length > 0) {
          headline += ` MAD retaliation triggered by ${e.retaliations.length} empire${e.retaliations.length > 1 ? 's' : ''}.`;
        }
      } else if (evt.type === 'research') {
        const e = evt as ResearchEvent;
        if (e.branch === 'military' && e.newLevel === 5) {
          const p = players[e.playerId]?.name ?? e.playerId;
          headline = `☢️ ${p} has achieved nuclear capability!`;
        }
      }

      if (headline) {
        const syntheticReport: AnalystReport = {
          id: `breaking-evt-${Date.now()}-${Math.random()}`,
          type: 'breaking',
          turnRange: [0, 0],
          text: headline,
          isStreaming: false,
          timestamp: Date.now(),
        };
        lastSeenId.current = syntheticReport.id;
        setCurrentReport(syntheticReport);
        setVisible(true);
        if (dismissTimer.current) clearTimeout(dismissTimer.current);
        dismissTimer.current = setTimeout(() => setVisible(false), 10000);
      }
    }
  }, [events.length, players, territories]);

  if (!currentReport || !visible) return null;

  return (
    <div
      className="absolute bottom-4 left-4 right-4 z-20 cursor-pointer animate-slide-up"
      onClick={onClickReport}
    >
      <div className="bg-zinc-950/90 backdrop-blur-sm border border-red-900/50 px-4 py-2.5 flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-mono text-red-400 uppercase font-bold tracking-widest">
            Breaking
          </span>
        </div>
        <p className="text-red-300 text-sm font-medium leading-snug truncate">
          {currentReport.text}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setVisible(false);
          }}
          className="text-zinc-600 hover:text-zinc-400 text-xs font-mono shrink-0"
        >
          &times;
        </button>
      </div>
    </div>
  );
}
