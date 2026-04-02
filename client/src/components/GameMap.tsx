"use client";

import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import type { SerializedGameState } from "@/lib/types";
import { TERRITORY_SHAPES, CONTINENT_COLORS } from "@/lib/map-paths";
import { useMapZoom } from "@/lib/useMapZoom";
import Territory from "./Territory";

interface GameMapProps {
  gameState: SerializedGameState;
  highlightPlayerId: string | null;
  onTerritoryClick: (territoryId: string) => void;
  onTerritoryHover: (territoryId: string | null) => void;
  hoveredTerritory: string | null;
  focusRegion?: { territoryIds: string[] } | null;
  children?: React.ReactNode; // for MapAnimations overlay
}

export default memo(function GameMap({
  gameState,
  highlightPlayerId,
  onTerritoryClick,
  onTerritoryHover,
  hoveredTerritory,
  focusRegion,
  children,
}: GameMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { viewBox, zoomLevel, wasPanning, resetZoom, focusOn, handlers } = useMapZoom(svgRef, containerRef);

  // Zoom to focus region when it changes
  useEffect(() => {
    if (focusRegion?.territoryIds.length) {
      focusOn(focusRegion.territoryIds);
    }
  }, [focusRegion, focusOn]);

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

  // Diplomatic relationship lines between empires
  const diplomacyLines = useMemo(() => {
    const agreements = gameState.agreements ?? [];
    const sanctions = gameState.sanctions ?? [];
    const shapeMap = new Map(TERRITORY_SHAPES.map((s) => [s.id, s]));

    // Find "capital" (most troops) for each player
    const playerCapitals = new Map<string, { cx: number; cy: number }>();
    const playerTroopMax = new Map<string, number>();
    for (const t of Object.values(gameState.map.territories)) {
      if (!t.ownerId) continue;
      const current = playerTroopMax.get(t.ownerId) ?? 0;
      if (t.troops > current) {
        playerTroopMax.set(t.ownerId, t.troops);
        const shape = shapeMap.get(t.id);
        if (shape) playerCapitals.set(t.ownerId, { cx: shape.cx, cy: shape.cy });
      }
    }

    const lines: { x1: number; y1: number; x2: number; y2: number; color: string; dash: string }[] = [];

    for (const a of agreements) {
      const [p1, p2] = a.parties;
      const c1 = playerCapitals.get(p1);
      const c2 = playerCapitals.get(p2);
      if (!c1 || !c2) continue;
      const color = a.type === 'militaryAlliance' ? '#34d399' : a.type === 'tradeDeal' ? '#60a5fa' : '#a1a1aa';
      const dash = a.type === 'militaryAlliance' ? '' : '6 3';
      lines.push({ x1: c1.cx, y1: c1.cy, x2: c2.cx, y2: c2.cy, color, dash });
    }

    for (const s of sanctions) {
      const target = playerCapitals.get(s.targetPlayerId);
      for (const sup of s.supporters) {
        const source = playerCapitals.get(sup);
        if (!target || !source) continue;
        lines.push({ x1: source.cx, y1: source.cy, x2: target.cx, y2: target.cy, color: '#ef4444', dash: '3 3' });
      }
    }

    return lines;
  }, [gameState.agreements, gameState.sanctions, gameState.map.territories]);

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
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden"
      style={{ backgroundColor: "#0c1929" }}
    >
      <svg
        ref={svgRef}
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        className="absolute inset-0 w-full h-full select-none"
        style={{
          cursor: "grab",
          touchAction: "none",
        }}
        preserveAspectRatio="none"
        {...handlers}
      >
        {/* Ocean background — extra padding for slice overflow */}
        <rect x="-500" y="-500" width="3000" height="1857" fill="#0c1929" />

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

        {/* Diplomatic relationship lines */}
        {diplomacyLines.map((line, i) => (
          <line
            key={`dip-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke={line.color}
            strokeWidth={1.5}
            strokeOpacity={0.5}
            strokeDasharray={line.dash || undefined}
          />
        ))}

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

          const isHighlighted =
            highlightPlayerId !== null && territory.ownerId === highlightPlayerId;
          const isDimmed =
            highlightPlayerId !== null && territory.ownerId !== highlightPlayerId;

          return (
            <Territory
              key={shape.id}
              shape={shape}
              territory={territory}
              owner={owner}
              isHighlighted={isHighlighted}
              isDimmed={isDimmed}
              onClick={handleTerritoryClick}
              onHover={onTerritoryHover}
              continentColor={continentColor}
              viewBox={viewBox}
            />
          );
        })}
        {/* Animation overlay */}
        {children}
      </svg>

      {/* Reset zoom button */}
      {zoomLevel > 1.05 && (
        <button
          onClick={resetZoom}
          className="absolute top-2 left-2 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 text-[10px] font-mono px-2 py-1 border border-zinc-800 transition-colors"
        >
          RESET ZOOM
        </button>
      )}

      {/* Hover tooltip */}
      {tooltip && (
        <div className="absolute top-2 right-2 bg-zinc-950 border border-zinc-800 px-3 py-2 pointer-events-none">
          <div className="font-mono font-bold text-xs text-zinc-200">{tooltip.territory.name}</div>
          <div className="text-zinc-500 text-[11px] font-mono">
            <span style={{ color: tooltip.owner?.color ?? "#555" }}>
              {tooltip.owner?.name ?? "Unowned"}
            </span>
          </div>
          <div className="text-zinc-500 text-[11px] font-mono">{tooltip.territory.troops} troops</div>
          {tooltip.continent && (
            <div className="text-zinc-700 text-[10px] font-mono">
              {tooltip.continent.name} +{tooltip.continent.bonusTroops}
            </div>
          )}
          {/* Terrain */}
          {tooltip.territory.terrain && tooltip.territory.terrain !== 'plains' && (
            <div className="text-zinc-500 text-[10px] font-mono">
              {tooltip.territory.terrain === 'mountains' ? '⛰ Mountains +50% def' : '🌊 Coastal'}
            </div>
          )}
          {/* Resources */}
          {tooltip.territory.resources && Object.keys(tooltip.territory.resources).length > 0 && (
            <div className="text-zinc-500 text-[10px] font-mono">
              {tooltip.territory.resources.oil ? `🛢${tooltip.territory.resources.oil} ` : ''}
              {tooltip.territory.resources.minerals ? `⛏${tooltip.territory.resources.minerals} ` : ''}
              {tooltip.territory.resources.food ? `🌾${tooltip.territory.resources.food} ` : ''}
              {tooltip.territory.resources.money ? `💰${tooltip.territory.resources.money}` : ''}
            </div>
          )}
          {/* Fort */}
          {(tooltip.territory.fortLevel ?? 0) > 0 && (
            <div className="text-blue-400 text-[10px] font-mono">
              🛡 Fort Lv {tooltip.territory.fortLevel} (+{(tooltip.territory.fortLevel ?? 0) * 20}% def)
            </div>
          )}
          {/* Fallout */}
          {(tooltip.territory.falloutTurns ?? 0) > 0 && (
            <div className="text-amber-400 text-[10px] font-mono">
              ☢️ Fallout: {tooltip.territory.falloutTurns} turns
            </div>
          )}
        </div>
      )}
    </div>
  );
});
