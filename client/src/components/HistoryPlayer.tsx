"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface HistoryPlayerProps {
  totalTurns: number;
  currentLiveTurn: number;
  viewingTurn: number | null;
  onGoToTurn: (turn: number) => void;
  onGoToLive: () => void;
  onClose: () => void;
}

export default function HistoryPlayer({
  totalTurns,
  currentLiveTurn,
  viewingTurn,
  onGoToTurn,
  onGoToLive,
  onClose,
}: HistoryPlayerProps) {
  const maxTurn = Math.max(totalTurns, currentLiveTurn, 1);
  const activeTurn = viewingTurn ?? currentLiveTurn;
  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeTurnRef = useRef(activeTurn);
  activeTurnRef.current = activeTurn;

  // Auto-play: step forward every 300ms
  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    intervalRef.current = setInterval(() => {
      const next = activeTurnRef.current + 1;
      if (next > maxTurn) {
        setPlaying(false);
        return;
      }
      onGoToTurn(next);
    }, 300);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, maxTurn, onGoToTurn]);

  const stepBack = useCallback(() => {
    setPlaying(false);
    const prev = Math.max(1, activeTurn - 1);
    onGoToTurn(prev);
  }, [activeTurn, onGoToTurn]);

  const stepForward = useCallback(() => {
    setPlaying(false);
    const next = Math.min(maxTurn, activeTurn + 1);
    onGoToTurn(next);
  }, [activeTurn, maxTurn, onGoToTurn]);

  const togglePlay = useCallback(() => {
    // If at the end, restart from beginning
    if (!playing && activeTurn >= maxTurn) {
      onGoToTurn(1);
    }
    setPlaying((p) => !p);
  }, [playing, activeTurn, maxTurn, onGoToTurn]);

  const handleScrub = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPlaying(false);
      onGoToTurn(parseInt(e.target.value, 10));
    },
    [onGoToTurn],
  );

  const handleLive = useCallback(() => {
    setPlaying(false);
    onGoToLive();
  }, [onGoToLive]);

  const handleClose = useCallback(() => {
    setPlaying(false);
    onClose();
  }, [onClose]);

  const pct = ((activeTurn / maxTurn) * 100).toFixed(1);
  const isViewingHistory = viewingTurn !== null;

  return (
    <div className="flex items-center gap-3 px-4 h-11 bg-zinc-950 border-t border-zinc-800">
      {/* Transport controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={stepBack}
          className="text-zinc-500 hover:text-zinc-300 text-xs font-mono w-6 h-6 flex items-center justify-center transition-colors"
          title="Step back"
        >
          {"<"}
        </button>
        <button
          onClick={togglePlay}
          className="text-zinc-400 hover:text-zinc-200 text-sm font-mono w-7 h-7 flex items-center justify-center transition-colors"
          title={playing ? "Pause" : "Play"}
        >
          {playing ? "||" : "\u25B6"}
        </button>
        <button
          onClick={stepForward}
          className="text-zinc-500 hover:text-zinc-300 text-xs font-mono w-6 h-6 flex items-center justify-center transition-colors"
          title="Step forward"
        >
          {">"}
        </button>
      </div>

      {/* Turn counter */}
      <span className="text-zinc-500 text-xs font-mono tabular-nums shrink-0 w-20">
        T{activeTurn} / T{maxTurn}
      </span>

      {/* Scrubber track */}
      <div className="flex-1 relative h-6 flex items-center">
        {/* Background track */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] bg-zinc-800 rounded-full" />
        {/* Fill */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-[3px] rounded-full bg-blue-600"
          style={{ width: `${pct}%` }}
        />
        {/* Range input */}
        <input
          type="range"
          min={1}
          max={maxTurn}
          value={activeTurn}
          onChange={handleScrub}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ zIndex: 1 }}
        />
        {/* Thumb indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-blue-500 border-2 border-zinc-950 pointer-events-none"
          style={{ left: `${pct}%` }}
        />
      </div>

      {/* Live / Close */}
      <div className="flex items-center gap-2 shrink-0">
        {isViewingHistory && (
          <button
            onClick={handleLive}
            className="text-blue-400 hover:text-blue-300 text-xs font-mono transition-colors"
          >
            LIVE
          </button>
        )}
        <button
          onClick={handleClose}
          className="text-zinc-600 hover:text-zinc-400 text-xs font-mono transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
