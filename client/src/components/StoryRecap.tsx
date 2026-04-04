"use client";

import { useState, useCallback, useMemo } from "react";
import type { MajorEvent } from "@/lib/types";
import { TERRITORY_SHAPES, CONTINENT_COLORS } from "@/lib/map-paths";

interface StoryRecapProps {
  majorEvents: MajorEvent[];
  playerNames: Record<string, { name: string; color: string }>;
  currentSituation?: string;
  currentTurn: number;
  onDismiss: () => void;
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

  // Build panels: major events + final "current situation" panel
  const panels = useMemo((): Panel[] => {
    const items: Panel[] = majorEvents.map((event) => ({
      type: 'event' as const,
      event,
    }));
    items.push({ type: 'current', event: null });
    return items;
  }, [majorEvents]);

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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative w-full max-w-2xl mx-4">
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
          <div className="px-6 py-8 min-h-[300px] flex flex-col justify-center">
            {panel.type === 'event' ? (
              <EventPanel
                event={panel.event}
                playerNames={playerNames}
              />
            ) : (
              <CurrentSituationPanel
                situation={currentSituation}
                currentTurn={currentTurn}
                playerNames={playerNames}
                onEnter={onDismiss}
              />
            )}
          </div>

          {/* Footer: navigation + progress */}
          <div className="px-6 py-3 border-t border-zinc-800/50 flex items-center justify-between">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="text-xs font-mono text-zinc-600 hover:text-zinc-400 disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              &larr; Prev
            </button>

            {/* Progress dots */}
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
      {/* Turn + tag */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[9px] font-mono text-zinc-600">TURN {event.turnNumber}</span>
        <span
          className="text-[8px] font-mono uppercase px-1.5 py-0.5 rounded"
          style={{ color: style.tagColor, backgroundColor: style.tagBg }}
        >
          {style.tag}
        </span>
      </div>

      {/* Territory illustration */}
      <div className="mb-4 flex justify-center">
        <TerritoryIllustration
          territoryIds={event.territoryIds}
          playerIds={event.playerIds}
          playerNames={playerNames}
        />
      </div>

      {/* Headline */}
      <h3 className="text-lg font-semibold text-zinc-100 mb-2">
        {event.label}
      </h3>

      {/* Narrative */}
      {event.summary && (
        <p className="text-sm text-zinc-400 leading-relaxed mb-4">
          {event.summary}
        </p>
      )}

      {/* Player indicators */}
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
  playerNames,
  onEnter,
}: {
  situation?: string;
  currentTurn: number;
  playerNames: Record<string, { name: string; color: string }>;
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

function TerritoryIllustration({
  territoryIds,
  playerIds,
  playerNames,
}: {
  territoryIds: string[];
  playerIds: string[];
  playerNames: Record<string, { name: string; color: string }>;
}) {
  // Find matching territory shapes
  const shapes = territoryIds
    .map((id) => TERRITORY_SHAPES.find((s) => s.id === id))
    .filter(Boolean)
    .slice(0, 8); // limit to avoid visual clutter

  if (shapes.length === 0) {
    // Fallback: show player color circles
    return (
      <div className="flex items-center gap-3 py-4">
        {playerIds.map((pid) => {
          const p = playerNames[pid];
          if (!p) return null;
          return (
            <div
              key={pid}
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ backgroundColor: p.color }}
            >
              {p.name.charAt(0)}
            </div>
          );
        })}
      </div>
    );
  }

  // Calculate bounding box for all territories
  const allBboxes = shapes.map((s) => s!.bbox);
  const minX = Math.min(...allBboxes.map((b) => b.x));
  const minY = Math.min(...allBboxes.map((b) => b.y));
  const maxX = Math.max(...allBboxes.map((b) => b.x + b.w));
  const maxY = Math.max(...allBboxes.map((b) => b.y + b.h));
  const padding = 20;
  const viewBox = `${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`;

  // Assign colors: first player gets first color, etc.
  const primaryColor = playerNames[playerIds[0]]?.color ?? '#555';
  const secondaryColor = playerNames[playerIds[1]]?.color ?? '#333';

  return (
    <svg viewBox={viewBox} className="w-full max-w-xs h-24 opacity-60">
      {shapes.map((shape, i) => (
        <path
          key={shape!.id}
          d={shape!.path}
          fill={i % 2 === 0 ? primaryColor : secondaryColor}
          opacity={0.7}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={0.5}
        />
      ))}
    </svg>
  );
}
