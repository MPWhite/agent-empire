"use client";

import { useEffect, useRef } from "react";
import type { AnalystReport, GameEvent, Player, TurnNarrative, CommsHighlight } from "@/lib/types";
import ReportCard from "./ReportCard";
import EventCard from "./EventCard";
import CommsHighlightCard from "./CommsHighlightCard";

interface NewsFeedProps {
  reports: AnalystReport[];
  currentTurn: number;
  pendingTurns: number;
  events?: GameEvent[];
  players?: Record<string, Player>;
  territories?: Record<string, { name: string }>;
  narrative?: TurnNarrative | null;
}

// Tag each item with a sort key so we can interleave reports and events
type FeedItem =
  | { kind: 'report'; report: AnalystReport; sortKey: number }
  | { kind: 'event'; event: GameEvent; turnNumber: number; sortKey: number; contextLine?: string }
  | { kind: 'commsHighlight'; highlight: CommsHighlight; turnNumber: number; sortKey: number };

export default function NewsFeed({
  reports,
  currentTurn,
  pendingTurns,
  events = [],
  players = {},
  territories = {},
  narrative,
}: NewsFeedProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [reports.length, events.length, reports[reports.length - 1]?.text]);

  // Build interleaved feed: events first (older), reports interspersed
  const items: FeedItem[] = [];

  // Filter out noisy events (resourceProduction, reinforcement)
  const significantEvents = events.filter(
    (e) => e.type !== 'resourceProduction'
  );

  // Add events with optional context lines
  for (let i = 0; i < significantEvents.length; i++) {
    const contextLine = narrative?.contextLines.find(
      (cl) => cl.eventIndex === events.indexOf(significantEvents[i])
    )?.context;
    items.push({ kind: 'event', event: significantEvents[i], turnNumber: currentTurn, sortKey: i, contextLine });
  }

  // Add comms highlights
  if (narrative?.commsHighlights) {
    for (let i = 0; i < narrative.commsHighlights.length; i++) {
      items.push({
        kind: 'commsHighlight',
        highlight: narrative.commsHighlights[i],
        turnNumber: currentTurn,
        sortKey: significantEvents.length + i,
      });
    }
  }

  // Add reports (placed after events + comms)
  for (let i = 0; i < reports.length; i++) {
    items.push({ kind: 'report', report: reports[i], sortKey: significantEvents.length + (narrative?.commsHighlights?.length ?? 0) + i });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-3 py-1.5 z-10">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest font-mono flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            War Desk
          </h3>
          {pendingTurns > 0 && (
            <span className="text-xs font-mono text-zinc-600">
              Gathering intel...
            </span>
          )}
        </div>
      </div>

      <div className="overflow-y-auto panel-scroll flex-1 min-h-0">
        {items.length === 0 && (
          <div className="px-3 py-8 text-center">
            <div className="text-zinc-600 text-sm font-mono mb-1">
              AWAITING FIRST DISPATCH
            </div>
            <div className="text-zinc-700 text-xs font-mono">
              First report in ~{Math.max(1, 3 - currentTurn)} turns
            </div>
          </div>
        )}
        {items.map((item, i) => {
          if (item.kind === 'report') {
            return <ReportCard key={`r-${item.report.id}`} report={item.report} />;
          }
          if (item.kind === 'commsHighlight') {
            return (
              <CommsHighlightCard
                key={`ch-${i}`}
                highlight={item.highlight}
                turnNumber={item.turnNumber}
                players={players}
              />
            );
          }
          return (
            <EventCard
              key={`e-${i}`}
              event={item.event}
              turnNumber={item.turnNumber}
              players={players}
              territories={territories}
              contextLine={item.contextLine}
            />
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
