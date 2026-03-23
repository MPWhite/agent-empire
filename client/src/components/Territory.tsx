"use client";

import type { Territory as TerritoryData, Player } from "@/lib/types";
import type { TerritoryShape } from "@/lib/map-paths";
import type { ViewBox } from "@/lib/useMapZoom";

interface TerritoryProps {
  shape: TerritoryShape;
  territory: TerritoryData;
  owner: Player | null;
  isSelected: boolean;
  isTargetable: boolean;
  onClick: (territoryId: string) => void;
  onHover: (territoryId: string | null) => void;
  continentColor?: string;
  viewBox: ViewBox;
}

export default function Territory({
  shape,
  territory,
  owner,
  isSelected,
  isTargetable,
  onClick,
  onHover,
  continentColor,
  viewBox,
}: TerritoryProps) {
  const fillColor = owner?.color ?? continentColor ?? "#3a5a40";
  const fillOpacity = owner ? Math.min(0.5 + (territory.troops / 30) * 0.4, 0.9) : 0.4;

  let strokeColor = "#1a2740";
  let strokeWidth = 0.5;
  if (isSelected) {
    strokeColor = "#fbbf24";
    strokeWidth = 2;
  } else if (isTargetable) {
    strokeColor = "#ef4444";
    strokeWidth = 1.5;
  }

  // Show labels when territory occupies enough of the visible area
  const territoryArea = shape.bbox.w * shape.bbox.h;
  const viewBoxArea = viewBox.w * viewBox.h;
  const screenFraction = territoryArea / viewBoxArea;
  const showLabels = screenFraction > 0.003;

  // Counter-scale labels so they stay a consistent screen size (like Google Maps pins)
  const zoomLevel = 2000 / viewBox.w;
  const labelScale = 1.8 / zoomLevel;

  return (
    <g
      className="cursor-pointer"
      onClick={() => onClick(territory.id)}
      onMouseEnter={() => onHover(territory.id)}
      onMouseLeave={() => onHover(null)}
    >
      <path
        d={shape.path}
        fill={fillColor}
        fillOpacity={fillOpacity}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        className="transition-all duration-150 hover:brightness-125"
      />
      {/* Labels: troop count + territory name — fade in when zoomed enough */}
      <g
        transform={`translate(${shape.cx}, ${shape.cy}) scale(${labelScale}) translate(${-shape.cx}, ${-shape.cy})`}
        style={{
          opacity: showLabels ? 1 : 0,
          transition: "opacity 300ms ease-in-out",
          pointerEvents: showLabels ? "auto" : "none",
        }}
      >
        <circle cx={shape.cx} cy={shape.cy} r={14} fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} />
        <text
          x={shape.cx}
          y={shape.cy + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="white"
          fontSize={12}
          fontWeight="bold"
          fontFamily="var(--font-geist-mono)"
        >
          {territory.troops}
        </text>
        <text
          x={shape.cx}
          y={shape.cy - 20}
          textAnchor="middle"
          fill="rgba(255,255,255,0.7)"
          fontSize={9}
          fontFamily="var(--font-geist-sans)"
        >
          {territory.name}
        </text>
      </g>
    </g>
  );
}
