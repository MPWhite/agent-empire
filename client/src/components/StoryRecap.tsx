"use client";

import { useState, useCallback, useMemo } from "react";
import type { MajorEvent } from "@/lib/types";

interface StoryRecapProps {
  majorEvents: MajorEvent[];
  playerNames: Record<string, { name: string; color: string }>;
  currentSituation?: string;
  currentTurn: number;
  onDismiss: () => void;
}

const MAX_RECAP_PANELS = 3;

/**
 * Condense a potentially long list of major events into at most MAX_RECAP_PANELS
 * summary panels that give viewers the key storylines.
 *
 * Priority: eliminations & victories first, then continent captures, then wars.
 * If there are more events than slots, group wars together and summarize.
 */
function summarizeEvents(events: MajorEvent[], playerNames: Record<string, { name: string; color: string }>): MajorEvent[] {
  if (events.length <= MAX_RECAP_PANELS) return events;

  // Separate by priority
  const eliminations = events.filter(e => e.type === 'elimination' || e.type === 'victory');
  const captures = events.filter(e => e.type === 'continent_capture');
  const wars = events.filter(e => e.type === 'major_war');
  const starts = events.filter(e => e.type === 'game_start');

  const picked: MajorEvent[] = [];

  // Always include game_start if it has a summary
  const start = starts[0];
  if (start?.summary) {
    picked.push(start);
  }

  // Add eliminations/victories (most dramatic)
  for (const e of eliminations) {
    if (picked.length >= MAX_RECAP_PANELS) break;
    picked.push(e);
  }

  // Add continent captures
  for (const e of captures) {
    if (picked.length >= MAX_RECAP_PANELS) break;
    picked.push(e);
  }

  // If we still have room, add wars
  for (const e of wars) {
    if (picked.length >= MAX_RECAP_PANELS) break;
    picked.push(e);
  }

  // If we had to skip things, merge remaining wars into the last war panel
  if (picked.length >= MAX_RECAP_PANELS && wars.length > 1) {
    const includedWars = picked.filter(e => e.type === 'major_war');
    const skippedWars = wars.filter(w => !includedWars.includes(w));
    if (skippedWars.length > 0 && includedWars.length > 0) {
      const lastWar = includedWars[includedWars.length - 1];
      const allWarPlayers = new Set([...lastWar.playerIds, ...skippedWars.flatMap(w => w.playerIds)]);
      lastWar.label = `${wars.length} major conflicts`;
      lastWar.summary = lastWar.summary || `Multiple empires clashed across the map.`;
      lastWar.playerIds = [...allWarPlayers];
    }
  }

  // Sort by turn number
  picked.sort((a, b) => a.turnNumber - b.turnNumber);

  // If we ended up with nothing meaningful, just take the most recent events
  if (picked.length === 0) {
    return events.slice(-MAX_RECAP_PANELS);
  }

  return picked.slice(0, MAX_RECAP_PANELS);
}

const EVENT_TYPE_STYLES: Record<string, { tag: string; tagColor: string; tagBg: string }> = {
  game_start: { tag: 'ORIGINS', tagColor: '#a1a1aa', tagBg: 'rgba(63,63,70,0.3)' },
  major_war: { tag: 'WAR', tagColor: '#fca5a5', tagBg: 'rgba(127,29,29,0.3)' },
  continent_capture: { tag: 'CONQUEST', tagColor: '#fbbf24', tagBg: 'rgba(120,53,15,0.3)' },
  elimination: { tag: 'ELIMINATED', tagColor: '#ef4444', tagBg: 'rgba(127,29,29,0.3)' },
  victory: { tag: 'VICTORY', tagColor: '#fbbf24', tagBg: 'rgba(120,53,15,0.3)' },
};

export default function StoryRecap({
  majorEvents,
  playerNames,
  currentSituation,
  currentTurn,
  onDismiss,
}: StoryRecapProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  type Panel = { type: 'event'; event: MajorEvent } | { type: 'current'; event: null };

  const panels = useMemo((): Panel[] => {
    const condensed = summarizeEvents(majorEvents, playerNames);
    const items: Panel[] = condensed.map((event) => ({
      type: 'event' as const,
      event,
    }));
    items.push({ type: 'current', event: null });
    return items;
  }, [majorEvents, playerNames]);

  const totalPanels = panels.length;
  const isLast = currentIndex === totalPanels - 1;

  const goNext = useCallback(() => {
    if (isLast) {
      onDismiss();
    } else {
      setCurrentIndex((i) => Math.min(i + 1, totalPanels - 1));
    }
  }, [isLast, totalPanels, onDismiss]);

  const goPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  const panel = panels[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div className="relative w-full max-w-lg mx-4">
        <div className="border border-zinc-800 bg-zinc-950 rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-3 border-b border-zinc-800/50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-mono text-red-400 uppercase tracking-[0.15em]">
                  Previously on Agent Empires
                </span>
              </div>
              <div className="text-[10px] font-mono text-zinc-600">
                Turn {currentTurn} &bull; {Object.values(playerNames).length} empires
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="text-zinc-600 hover:text-zinc-400 text-xs font-mono transition-colors"
            >
              Skip &rarr;
            </button>
          </div>

          {/* Panel content */}
          <div className="px-6 py-8 min-h-[200px] flex flex-col justify-center">
            {panel.type === 'event' ? (
              <EventPanel event={panel.event} playerNames={playerNames} />
            ) : (
              <CurrentSituationPanel
                situation={currentSituation}
                currentTurn={currentTurn}
                onEnter={onDismiss}
              />
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-zinc-800/50 flex items-center justify-between">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="text-xs font-mono text-zinc-600 hover:text-zinc-400 disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              &larr; Prev
            </button>

            <div className="flex gap-1.5">
              {panels.map((_, i) => (
                <div
                  key={i}
                  className="h-[3px] rounded-full transition-colors"
                  style={{
                    width: 16,
                    backgroundColor: i <= currentIndex ? '#ef4444' : '#3f3f46',
                  }}
                />
              ))}
            </div>

            <button
              onClick={goNext}
              className="text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              {isLast ? 'Enter' : 'Next'} &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventPanel({
  event,
  playerNames,
}: {
  event: MajorEvent;
  playerNames: Record<string, { name: string; color: string }>;
}) {
  const style = EVENT_TYPE_STYLES[event.type] ?? EVENT_TYPE_STYLES.game_start;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[9px] font-mono text-zinc-600">TURN {event.turnNumber}</span>
        <span
          className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded"
          style={{ color: style.tagColor, backgroundColor: style.tagBg }}
        >
          {style.tag}
        </span>
      </div>

      <h3 className="text-lg font-semibold text-zinc-100 mb-2">
        {event.label}
      </h3>

      {event.summary && (
        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
          {event.summary}
        </p>
      )}

      <div className="flex gap-3 flex-wrap">
        {event.playerIds.map((pid) => {
          const p = playerNames[pid];
          if (!p) return null;
          return (
            <div key={pid} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-[10px] font-mono text-zinc-500">{p.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CurrentSituationPanel({
  situation,
  currentTurn,
  onEnter,
}: {
  situation?: string;
  currentTurn: number;
  onEnter: () => void;
}) {
  return (
    <div className="text-center">
      <div className="text-[9px] font-mono text-red-400 uppercase tracking-[0.15em] mb-2">
        NOW
      </div>
      <h3 className="text-lg font-semibold text-zinc-100 mb-3">
        Turn {currentTurn} — The Current Situation
      </h3>
      {situation && (
        <p className="text-sm text-zinc-400 leading-relaxed mb-6 max-w-md mx-auto">
          {situation}
        </p>
      )}
      <button
        onClick={onEnter}
        className="px-6 py-2.5 border border-red-900/50 text-red-300 text-sm font-medium hover:bg-red-950/30 transition-colors rounded"
      >
        Watch it unfold live
      </button>
    </div>
  );
}
