"use client";

import { useMemo } from "react";
import type { Player } from "@/lib/types";
import type { TurnHistoryEntry } from "@/lib/useTurnHistory";

interface TerritoryChartProps {
  history: TurnHistoryEntry[];
  players: Record<string, Player>;
  selectedPlayerId: string;
}

const CHART_W = 320;
const CHART_H = 120;
const PAD = { top: 6, right: 8, bottom: 18, left: 28 };
const PLOT_W = CHART_W - PAD.left - PAD.right;
const PLOT_H = CHART_H - PAD.top - PAD.bottom;

export default function TerritoryChart({
  history,
  players,
  selectedPlayerId,
}: TerritoryChartProps) {
  // Synthesize a second point if only one history entry so the chart can render
  const effectiveHistory = useMemo(() => {
    if (history.length === 0) return [];
    if (history.length === 1) {
      // Duplicate the single entry at turn 0 (or turn-1) so we get a flat line
      const entry = history[0];
      const syntheticTurn = Math.max(entry.turn - 1, 0);
      if (syntheticTurn === entry.turn) {
        // turn 0 — duplicate as turn 1
        return [entry, { ...entry, turn: entry.turn + 1 }];
      }
      return [{ ...entry, turn: syntheticTurn }, entry];
    }
    return history;
  }, [history]);

  const { paths, gridLines, xLabels, yLabels, maxY } = useMemo(() => {
    if (effectiveHistory.length < 2) return { paths: [], gridLines: [], xLabels: [], yLabels: [], maxY: 5 };

    const playerIds = Object.keys(players);
    const turns = effectiveHistory.map((h) => h.turn);
    const minT = turns[0];
    const maxT = turns[turns.length - 1];
    const rangeT = Math.max(maxT - minT, 1);

    // Find max territory count across all players and turns
    let peak = 0;
    for (const entry of effectiveHistory) {
      for (const stats of Object.values(entry.players)) {
        if (stats.territories > peak) peak = stats.territories;
      }
    }
    const maxY = Math.max(Math.ceil(peak * 1.15), 5);

    const toX = (turn: number) => PAD.left + ((turn - minT) / rangeT) * PLOT_W;
    const toY = (val: number) => PAD.top + PLOT_H - (val / maxY) * PLOT_H;

    // Build paths per player
    const paths: {
      id: string;
      color: string;
      isSelected: boolean;
      isAlive: boolean;
      linePath: string;
      areaPath: string;
      lastPoint: { x: number; y: number };
    }[] = [];

    for (const pid of playerIds) {
      const player = players[pid];
      if (!player) continue;

      const points: { x: number; y: number }[] = [];
      let lastAliveIdx = -1;

      for (let i = 0; i < effectiveHistory.length; i++) {
        const entry = effectiveHistory[i];
        const stats = entry.players[pid];
        if (!stats) continue;
        const x = toX(entry.turn);
        const y = toY(stats.territories);
        points.push({ x, y });
        if (stats.territories > 0) lastAliveIdx = i;
      }

      if (points.length < 2) continue;

      // Trim to last alive point for eliminated players
      const trimmed = lastAliveIdx >= 0 ? points.slice(0, lastAliveIdx + 1) : points;
      if (trimmed.length < 2) continue;

      const lineSegments = trimmed.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`));
      const linePath = lineSegments.join(" ");

      const bottomY = PAD.top + PLOT_H;
      const areaPath =
        `M${trimmed[0].x},${bottomY} ` +
        trimmed.map((p) => `L${p.x},${p.y}`).join(" ") +
        ` L${trimmed[trimmed.length - 1].x},${bottomY} Z`;

      paths.push({
        id: pid,
        color: player.color,
        isSelected: pid === selectedPlayerId,
        isAlive: player.isAlive,
        linePath,
        areaPath,
        lastPoint: trimmed[trimmed.length - 1],
      });
    }

    // Sort: selected player last (renders on top)
    paths.sort((a, b) => (a.isSelected ? 1 : 0) - (b.isSelected ? 1 : 0));

    // Grid lines (horizontal)
    const yStep = maxY <= 10 ? 2 : maxY <= 30 ? 5 : 10;
    const gridLines: { y: number; label: string }[] = [];
    for (let v = yStep; v < maxY; v += yStep) {
      gridLines.push({ y: toY(v), label: v.toString() });
    }

    // X-axis labels
    const xLabels: { x: number; label: string }[] = [];
    const turnCount = turns.length;
    const labelInterval = turnCount <= 10 ? 1 : turnCount <= 30 ? 5 : 10;
    for (const turn of turns) {
      if ((turn - minT) % labelInterval === 0 || turn === maxT) {
        xLabels.push({ x: toX(turn), label: `${turn}` });
      }
    }

    // Y-axis labels
    const yLabels: { y: number; label: string }[] = [
      { y: toY(0), label: "0" },
      ...gridLines,
    ];

    return { paths, gridLines, xLabels, yLabels, maxY };
  }, [effectiveHistory, players, selectedPlayerId]);

  if (paths.length === 0) {
    return (
      <div className="w-full h-[140px] flex items-center justify-center">
        <span className="text-[10px] font-mono text-zinc-700 uppercase tracking-widest">
          Turn 1 — No History Yet
        </span>
      </div>
    );
  }

  return (
    <div className="w-full px-3 pt-2 pb-1">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Scanline effect */}
        <defs>
          <pattern id="scanlines" width="4" height="4" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="4" y2="0" stroke="currentColor" strokeWidth="0.5" className="text-zinc-700" opacity="0.06" />
          </pattern>
        </defs>
        <rect
          x={PAD.left}
          y={PAD.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="url(#scanlines)"
        />

        {/* Grid lines */}
        {gridLines.map((g, i) => (
          <line
            key={i}
            x1={PAD.left}
            y1={g.y}
            x2={PAD.left + PLOT_W}
            y2={g.y}
            stroke="currentColor"
            strokeWidth="0.5"
            className="text-zinc-800"
            opacity="0.5"
          />
        ))}

        {/* Bottom axis line */}
        <line
          x1={PAD.left}
          y1={PAD.top + PLOT_H}
          x2={PAD.left + PLOT_W}
          y2={PAD.top + PLOT_H}
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-zinc-800"
        />

        {/* Player area fills and lines */}
        {paths.map((p) => (
          <g key={p.id}>
            <path
              d={p.areaPath}
              fill={p.color}
              opacity={p.isSelected ? 0.15 : 0.05}
            />
            <path
              d={p.linePath}
              fill="none"
              stroke={p.color}
              strokeWidth={p.isSelected ? 2 : 1}
              opacity={p.isSelected ? 0.9 : 0.25}
              strokeLinejoin="round"
            />
            {/* Endpoint dot for selected player */}
            {p.isSelected && (
              <circle
                cx={p.lastPoint.x}
                cy={p.lastPoint.y}
                r={3}
                fill={p.color}
                opacity={0.9}
              />
            )}
            {/* Death marker for eliminated players */}
            {!p.isAlive && !p.isSelected && (
              <g opacity={0.4}>
                <line
                  x1={p.lastPoint.x - 3}
                  y1={p.lastPoint.y - 3}
                  x2={p.lastPoint.x + 3}
                  y2={p.lastPoint.y + 3}
                  stroke={p.color}
                  strokeWidth="1.5"
                />
                <line
                  x1={p.lastPoint.x + 3}
                  y1={p.lastPoint.y - 3}
                  x2={p.lastPoint.x - 3}
                  y2={p.lastPoint.y + 3}
                  stroke={p.color}
                  strokeWidth="1.5"
                />
              </g>
            )}
          </g>
        ))}

        {/* Y-axis labels */}
        {yLabels.map((yl, i) => (
          <text
            key={i}
            x={PAD.left - 4}
            y={yl.y + 3}
            textAnchor="end"
            className="fill-zinc-600"
            style={{ fontSize: "8px", fontFamily: "var(--font-mono, monospace)" }}
          >
            {yl.label}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((xl, i) => (
          <text
            key={i}
            x={xl.x}
            y={PAD.top + PLOT_H + 12}
            textAnchor="middle"
            className="fill-zinc-600"
            style={{ fontSize: "8px", fontFamily: "var(--font-mono, monospace)" }}
          >
            {xl.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
