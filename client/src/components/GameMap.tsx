"use client";

import { useMemo } from "react";
import type { SerializedGameState, Player } from "@/lib/types";
import { TERRITORY_SHAPES } from "@/lib/map-paths";
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
  // Draw adjacency lines
  const adjacencyLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
    const shapeMap = new Map(TERRITORY_SHAPES.map((s) => [s.id, s]));
    const seen = new Set<string>();

    for (const [id, neighbors] of Object.entries(gameState.map.adjacency)) {
      const from = shapeMap.get(id);
      if (!from) continue;
      for (const nid of neighbors) {
        const key = [id, nid].sort().join("-");
        if (seen.has(key)) continue;
        seen.add(key);
        const to = shapeMap.get(nid);
        if (!to) continue;
        lines.push({ x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy });
      }
    }
    return lines;
  }, [gameState.map.adjacency]);

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
        viewBox="0 0 920 750"
        className="w-full h-auto"
        style={{ maxHeight: "calc(100vh - 200px)" }}
      >
        {/* Background */}
        <rect width="920" height="750" fill="#f4f4f5" rx={8} />

        {/* Adjacency lines */}
        {adjacencyLines.map((line, i) => (
          <line
            key={i}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="rgba(0,0,0,0.08)"
            strokeWidth={1}
          />
        ))}

        {/* Territories */}
        {TERRITORY_SHAPES.map((shape) => {
          const territory = gameState.map.territories[shape.id];
          if (!territory) return null;
          const owner = territory.ownerId
            ? gameState.players[territory.ownerId]
            : null;

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
            />
          );
        })}
      </svg>

      {/* Hover tooltip */}
      {tooltip && (
        <div className="absolute top-2 right-2 bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm pointer-events-none shadow-sm">
          <div className="font-bold">{tooltip.territory.name}</div>
          <div className="text-zinc-500">
            Owner:{" "}
            <span style={{ color: tooltip.owner?.color ?? "#999" }}>
              {tooltip.owner?.name ?? "Unowned"}
            </span>
          </div>
          <div className="text-zinc-500">Troops: {tooltip.territory.troops}</div>
          {tooltip.continent && (
            <div className="text-zinc-400 text-xs">
              {tooltip.continent.name} (+{tooltip.continent.bonusTroops} bonus)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
