"use client";

import { useMemo } from "react";
import type { SerializedGameState } from "@/lib/types";
import { TERRITORY_SHAPES, CONTINENT_COLORS, SEA_PATHS } from "@/lib/map-paths";
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
        viewBox="0 0 1024 792"
        className="w-full h-auto"
        style={{ maxHeight: "calc(100vh - 200px)" }}
      >
        {/* Ocean background */}
        <rect width="1024" height="792" fill="#1a2740" rx={8} />

        {/* Sea/lake decorations */}
        <g fill="#1a2740" opacity={0.8}>
          <path d={SEA_PATHS.mediterranean} />
          <path d={SEA_PATHS.deadSea} />
          <path d={SEA_PATHS.blackSea} />
          <path d={SEA_PATHS.greatLakes} />
        </g>

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
        <text x={10} y={85} fill="rgba(255,255,255,0.3)" fontSize={7} fontFamily="var(--font-geist-sans)">
          → Kamchatka
        </text>
        <text x={950} y={55} fill="rgba(255,255,255,0.3)" fontSize={7} fontFamily="var(--font-geist-sans)" textAnchor="end">
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
              onClick={onTerritoryClick}
              onHover={onTerritoryHover}
              continentColor={continentColor}
            />
          );
        })}
      </svg>

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
