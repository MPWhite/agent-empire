"use client";

import { useMemo } from "react";
import type { MajorEvent, MajorEventType, Player } from "@/lib/types";

interface TimelineDrawerProps {
  majorEvents: MajorEvent[];
  totalTurns: number;
  currentLiveTurn: number;
  viewingTurn: number | null;
  selectedEvent: MajorEvent | null;
  players: Record<string, Player>;
  onSelectEvent: (event: MajorEvent) => void;
  onGoToTurn: (turn: number) => void;
  onGoToLive: () => void;
  onClose: () => void;
}

const EVENT_COLORS: Record<MajorEventType, string> = {
  game_start: "#22c55e",
  victory: "#22c55e",
  continent_capture: "#eab308",
  major_war: "#a855f7",
  elimination: "#ef4444",
};

const EVENT_BG_COLORS: Record<MajorEventType, string> = {
  game_start: "rgba(34, 197, 94, 0.1)",
  victory: "rgba(34, 197, 94, 0.1)",
  continent_capture: "rgba(234, 179, 8, 0.1)",
  major_war: "rgba(168, 85, 247, 0.1)",
  elimination: "rgba(239, 68, 68, 0.1)",
};

const EVENT_TYPE_LABELS: Record<MajorEventType, string> = {
  game_start: "GAME START",
  victory: "VICTORY",
  continent_capture: "CONTINENT",
  major_war: "MAJOR WAR",
  elimination: "ELIMINATION",
};

// Only these types get text labels on the scrubber
const LABELED_TYPES = new Set<MajorEventType>([
  "game_start",
  "elimination",
  "continent_capture",
  "victory",
]);

export default function TimelineDrawer({
  majorEvents,
  totalTurns,
  currentLiveTurn,
  viewingTurn,
  selectedEvent,
  players,
  onSelectEvent,
  onGoToTurn,
  onGoToLive,
  onClose,
}: TimelineDrawerProps) {
  const maxTurn = Math.max(totalTurns, currentLiveTurn, 1);

  // Separate events into labeled (important) and dot-only (wars)
  const { labeledEvents, dotOnlyEvents } = useMemo(() => {
    const labeled: { event: MajorEvent; leftPercent: number }[] = [];
    const dotOnly: { event: MajorEvent; leftPercent: number }[] = [];

    for (const event of majorEvents) {
      const pos = { event, leftPercent: (event.turnNumber / maxTurn) * 100 };
      if (LABELED_TYPES.has(event.type)) {
        labeled.push(pos);
      } else {
        dotOnly.push(pos);
      }
    }

    return { labeledEvents: labeled, dotOnlyEvents: dotOnly };
  }, [majorEvents, maxTurn]);

  // Assign stagger rows to labeled events to avoid overlap
  const staggeredLabels = useMemo(() => {
    const MIN_GAP_PERCENT = 8; // minimum % gap before staggering
    const result: { event: MajorEvent; leftPercent: number; row: number }[] = [];

    for (const item of labeledEvents) {
      // Find which row (0, 1) avoids collision
      let row = 0;
      for (const prev of result) {
        if (prev.row === 0 && Math.abs(prev.leftPercent - item.leftPercent) < MIN_GAP_PERCENT) {
          row = 1;
        }
      }
      result.push({ ...item, row });
    }
    return result;
  }, [labeledEvents]);

  return (
    <div className="bg-zinc-950 border-t border-zinc-800">
      {/* Viewing turn banner */}
      {viewingTurn !== null && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-amber-900/30 border-b border-amber-800/40">
          <span className="text-amber-400 text-xs font-mono font-bold tracking-wider">
            VIEWING TURN {viewingTurn}
          </span>
          <button
            onClick={onGoToLive}
            className="text-amber-400 hover:text-amber-300 text-xs font-mono transition-colors"
          >
            ↻ BACK TO LIVE
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-zinc-200 text-sm font-mono font-bold tracking-wider">
            GAME HISTORY
          </span>
          <span className="text-zinc-500 text-xs font-mono">
            {totalTurns} turns
          </span>
          {/* Legend */}
          <div className="flex items-center gap-3 ml-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-zinc-500 text-[10px] font-mono">ELIM</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-zinc-500 text-[10px] font-mono">CONT</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-zinc-500 text-[10px] font-mono">WAR</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {viewingTurn !== null && (
            <>
              <button
                onClick={onGoToLive}
                className="text-blue-400 hover:text-blue-300 text-[10px] font-mono transition-colors"
              >
                ↻ Back to Live
              </button>
              <div className="w-px h-3 bg-zinc-800" />
            </>
          )}
          <button
            onClick={onClose}
            className="text-zinc-600 hover:text-zinc-400 text-xs font-mono transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Scrubber */}
      <div className="px-4 pb-2">
        <div className="bg-zinc-900 rounded-md px-3 pt-2 pb-3 relative">
          {/* Labels area — fixed height with two stagger rows */}
          <div className="relative h-6 mb-1">
            {staggeredLabels.map(({ event, leftPercent, row }, i) => {
              const color = EVENT_COLORS[event.type];
              const isSelected =
                selectedEvent?.turnNumber === event.turnNumber &&
                selectedEvent?.type === event.type;

              return (
                <div
                  key={`label-${event.type}-${event.turnNumber}-${i}`}
                  className="absolute -translate-x-1/2 whitespace-nowrap cursor-pointer"
                  style={{
                    left: `${leftPercent}%`,
                    top: row === 0 ? "0px" : "11px",
                    zIndex: 2,
                  }}
                  onClick={() => onSelectEvent(event)}
                >
                  <span
                    className="font-mono font-bold tracking-wide"
                    style={{
                      color: isSelected ? "#fafafa" : color,
                      fontSize: "10px",
                    }}
                  >
                    {event.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Track + dots area */}
          <div className="relative h-4">
            {/* Turn numbers */}
            <div className="absolute -top-0.5 left-0 text-zinc-700 text-[8px] font-mono">1</div>
            <div className="absolute -top-0.5 right-0 text-zinc-700 text-[8px] font-mono">{maxTurn}</div>

            {/* Track line */}
            <div className="absolute top-[7px] left-0 right-0 h-[2px] bg-zinc-800 rounded-full" />

            {/* Progress fill when viewing history */}
            {viewingTurn !== null && (
              <div
                className="absolute top-[7px] left-0 h-[2px] rounded-full"
                style={{
                  width: `${(viewingTurn / maxTurn) * 100}%`,
                  background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
                  opacity: 0.6,
                }}
              />
            )}

            {/* War dots (small, no labels) */}
            {dotOnlyEvents.map(({ event, leftPercent }, i) => {
              const isSelected =
                selectedEvent?.turnNumber === event.turnNumber &&
                selectedEvent?.type === event.type;

              return (
                <div
                  key={`dot-${event.turnNumber}-${i}`}
                  className="absolute cursor-pointer rounded-full"
                  style={{
                    left: `${leftPercent}%`,
                    top: isSelected ? "4px" : "5px",
                    width: isSelected ? "8px" : "6px",
                    height: isSelected ? "8px" : "6px",
                    backgroundColor: isSelected ? "#c084fc" : "#7c3aed",
                    border: isSelected ? "1.5px solid #fafafa" : "1px solid #09090b",
                    transform: "translateX(-50%)",
                    opacity: isSelected ? 1 : 0.7,
                    zIndex: isSelected ? 2 : 1,
                  }}
                  onClick={() => onSelectEvent(event)}
                  title={`${event.label} — Turn ${event.turnNumber}`}
                />
              );
            })}

            {/* Important event dots (larger) */}
            {staggeredLabels.map(({ event, leftPercent }, i) => {
              const color = EVENT_COLORS[event.type];
              const isSelected =
                selectedEvent?.turnNumber === event.turnNumber &&
                selectedEvent?.type === event.type;

              return (
                <div
                  key={`important-${event.type}-${event.turnNumber}-${i}`}
                  className="absolute cursor-pointer rounded-full"
                  style={{
                    left: `${leftPercent}%`,
                    top: isSelected ? "2px" : "3px",
                    width: isSelected ? "12px" : "10px",
                    height: isSelected ? "12px" : "10px",
                    backgroundColor: color,
                    border: `2px solid ${isSelected ? "#fafafa" : "#09090b"}`,
                    transform: "translateX(-50%)",
                    zIndex: 2,
                  }}
                  onClick={() => onSelectEvent(event)}
                  title={`${event.label} — Turn ${event.turnNumber}`}
                />
              );
            })}

            {/* Playhead */}
            {viewingTurn !== null && (
              <div
                className="absolute -translate-x-1/2"
                style={{
                  left: `${(viewingTurn / maxTurn) * 100}%`,
                  top: "1px",
                  zIndex: 3,
                }}
              >
                <div
                  className="w-[14px] h-[14px] rounded-full bg-white border-2 border-blue-500"
                  style={{ boxShadow: "0 0 8px rgba(59, 130, 246, 0.6)" }}
                />
              </div>
            )}

            {/* Range input for free scrubbing */}
            <input
              type="range"
              min={1}
              max={maxTurn}
              value={viewingTurn ?? currentLiveTurn}
              onChange={(e) => onGoToTurn(parseInt(e.target.value, 10))}
              className="absolute left-0 right-0 opacity-0 cursor-pointer"
              style={{ top: "0px", height: "16px", zIndex: 0 }}
            />
          </div>
        </div>
      </div>

      {/* Detail card for selected event */}
      {selectedEvent && (
        <div className="px-4 pb-3">
          <div
            className="rounded-md border px-3 py-2.5"
            style={{
              backgroundColor: EVENT_BG_COLORS[selectedEvent.type],
              borderColor: `${EVENT_COLORS[selectedEvent.type]}33`,
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="text-xs font-mono font-bold tracking-wider"
                  style={{ color: EVENT_COLORS[selectedEvent.type] }}
                >
                  {EVENT_TYPE_LABELS[selectedEvent.type]}
                </span>
                <span className="text-zinc-500 text-xs font-mono">
                  Turn {selectedEvent.turnNumber}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedEvent.playerIds.map((pid) => {
                  const player = players[pid];
                  if (!player) return null;
                  return (
                    <div key={pid} className="flex items-center gap-1">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: player.color }}
                      />
                      <span className="text-zinc-400 text-xs font-mono">
                        {player.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-zinc-300 text-sm font-mono leading-relaxed">
              {selectedEvent.summary || fallbackSummary(selectedEvent, players)}
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {majorEvents.length === 0 && (
        <div className="px-4 pb-3">
          <div className="text-zinc-600 text-xs font-mono text-center py-2">
            No major events yet. Waiting for the first conflict...
          </div>
        </div>
      )}
    </div>
  );
}

function fallbackSummary(
  event: MajorEvent,
  players: Record<string, Player>,
): string {
  const names = event.playerIds.map((id) => players[id]?.name ?? id);

  switch (event.type) {
    case "game_start":
      return "Eight empires begin their campaigns for world domination.";
    case "elimination":
      return `${names[0]} eliminates ${names[1]} from the game.`;
    case "continent_capture":
      return `${names[0]} secures complete control of ${event.label}.`;
    case "major_war":
      return `${names[0]} and ${names[1]} clash in a major offensive across multiple fronts.`;
    case "victory":
      return `${names[0]} achieves total world domination.`;
    default:
      return event.label;
  }
}
