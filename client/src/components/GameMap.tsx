"use client";

import { useCallback, useMemo, useRef } from "react";
import type { SerializedGameState } from "@/lib/types";
import { TERRITORY_SHAPES, CONTINENT_COLORS } from "@/lib/map-paths";
import { useMapZoom } from "@/lib/useMapZoom";
import Territory from "./Territory";

interface GameMapProps {
  gameState: SerializedGameState;
  selectedTerritory: string | null;
  targetableTerritories: Set<string>;
  onTerritoryClick: (territoryId: string) => void;
  onTerritoryHover: (territoryId: string | null) => void;
  hoveredTerritory: string | null;
}

export default function GameMap({
  gameState,
  selectedTerritory,
  targetableTerritories,
  onTerritoryClick,
  onTerritoryHover,
  hoveredTerritory,
}: GameMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const { viewBox, zoomLevel, wasPanning, resetZoom, handlers } = useMapZoom(svgRef);

  const handleTerritoryClick = useCallback(
    (territoryId: string) => {
      if (wasPanning.current) return;
      onTerritoryClick(territoryId);
    },
    [onTerritoryClick, wasPanning]
  );

  // Draw adjacency lines for cross-continent connections
  const adjacencyLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; dashed: boolean }[] = [];
    const shapeMap = new Map(TERRITORY_SHAPES.map((s) => [s.id, s]));
    const seen = new Set<string>();

    // Get continent for each territory
    const territoryContinent = new Map<string, string>();
    for (const [, continent] of Object.entries(gameState.map.continents)) {
      for (const tid of continent.territoryIds) {
        territoryContinent.set(tid, continent.id);
      }
    }

    for (const [id, neighbors] of Object.entries(gameState.map.adjacency)) {
      const from = shapeMap.get(id);
      if (!from) continue;
      for (const nid of neighbors) {
        const key = [id, nid].sort().join("-");
        if (seen.has(key)) continue;
        seen.add(key);
        const to = shapeMap.get(nid);
        if (!to) continue;

        // Only draw lines for cross-continent connections
        const fromContinent = territoryContinent.get(id);
        const toContinent = territoryContinent.get(nid);
        if (fromContinent === toContinent) continue;

        // Skip the Alaska-Kamchatka wrap-around (would draw across the whole map)
        if (
          (id === "alaska" && nid === "kamchatka") ||
          (id === "kamchatka" && nid === "alaska")
        ) continue;

        lines.push({ x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy, dashed: true });
      }
    }
    return lines;
  }, [gameState.map.adjacency, gameState.map.continents]);

  const tooltip = useMemo(() => {
    if (!hoveredTerritory) return null;
    const territory = gameState.map.territories[hoveredTerritory];
    if (!territory) return null;
    const owner = territory.ownerId
      ? gameState.players[territory.ownerId]
      : null;
    const shape = TERRITORY_SHAPES.find((s) => s.id === hoveredTerritory);
    if (!shape) return null;

    const continent = Object.values(gameState.map.continents).find((c) =>
      c.territoryIds.includes(hoveredTerritory)
    );

    return { territory, owner, shape, continent };
  }, [hoveredTerritory, gameState]);

  return (
    <div className="relative w-full">
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="w-full h-auto select-none"
        style={{
          maxHeight: "calc(100vh - 200px)",
          cursor: zoomLevel > 1 ? "grab" : "default",
        }}
        {...handlers}
      >
        {/* Ocean background */}
        <rect width="2000" height="857" fill="#1a2740" rx={8} />

        {/* Cross-continent connection lines */}
        {adjacencyLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        ))}

        {/* Alaska-Kamchatka wrap-around indicator */}
        <text x={20} y={170} fill="rgba(255,255,255,0.3)" fontSize={14} fontFamily="var(--font-geist-sans)">
          → Kamchatka
        </text>
        <text x={1980} y={110} fill="rgba(255,255,255,0.3)" fontSize={14} fontFamily="var(--font-geist-sans)" textAnchor="end">
          Alaska ←
        </text>

        {/* Territories */}
        {TERRITORY_SHAPES.map((shape) => {
          const territory = gameState.map.territories[shape.id];
          if (!territory) return null;
          const owner = territory.ownerId
            ? gameState.players[territory.ownerId]
            : null;

          // Get continent color for unowned territories
          const continentId = Object.entries(gameState.map.continents).find(
            ([, c]) => c.territoryIds.includes(shape.id)
          )?.[0];
          const continentColor = continentId ? CONTINENT_COLORS[continentId] : undefined;

          return (
            <Territory
              key={shape.id}
              shape={shape}
              territory={territory}
              owner={owner}
              isSelected={selectedTerritory === shape.id}
              isTargetable={targetableTerritories.has(shape.id)}
              onClick={handleTerritoryClick}
              onHover={onTerritoryHover}
              continentColor={continentColor}
              viewBox={viewBox}
            />
          );
        })}
      </svg>

      {/* Reset zoom button */}
      {zoomLevel > 1.05 && (
        <button
          onClick={resetZoom}
          className="absolute top-2 left-2 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 text-xs px-2 py-1 rounded border border-zinc-600 backdrop-blur-sm transition-colors"
        >
          Reset Zoom
        </button>
      )}

      {/* Hover tooltip */}
      {tooltip && (
        <div className="absolute top-2 right-2 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm pointer-events-none shadow-lg">
          <div className="font-bold text-white">{tooltip.territory.name}</div>
          <div className="text-zinc-400">
            Owner:{" "}
            <span style={{ color: tooltip.owner?.color ?? "#666" }}>
              {tooltip.owner?.name ?? "Unowned"}
            </span>
          </div>
          <div className="text-zinc-400">Troops: {tooltip.territory.troops}</div>
          {tooltip.continent && (
            <div className="text-zinc-500 text-xs">
              {tooltip.continent.name} (+{tooltip.continent.bonusTroops} bonus)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
