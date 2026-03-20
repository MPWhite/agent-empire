"use client";

import type { Territory as TerritoryData, Player } from "@/lib/types";
import type { TerritoryShape } from "@/lib/map-paths";

interface TerritoryProps {
  shape: TerritoryShape;
  territory: TerritoryData;
  owner: Player | null;
  isSelected: boolean;
  isTargetable: boolean;
  onClick: (territoryId: string) => void;
  onHover: (territoryId: string | null) => void;
  continentColor?: string;
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
}: TerritoryProps) {
  const fillColor = owner?.color ?? continentColor ?? "#3a5a40";
  const fillOpacity = owner ? Math.min(0.5 + (territory.troops / 30) * 0.4, 0.9) : 0.4;

  let strokeColor = "#1a2740";
  let strokeWidth = 1;
  if (isSelected) {
    strokeColor = "#fbbf24";
    strokeWidth = 3;
  } else if (isTargetable) {
    strokeColor = "#ef4444";
    strokeWidth = 2.5;
  }

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
      {/* Troop count */}
      <circle cx={shape.cx} cy={shape.cy} r={11} fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} />
      <text
        x={shape.cx}
        y={shape.cy + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize={9}
        fontWeight="bold"
        fontFamily="var(--font-geist-mono)"
      >
        {territory.troops}
      </text>
      {/* Territory name */}
      <text
        x={shape.cx}
        y={shape.cy - 16}
        textAnchor="middle"
        fill="rgba(255,255,255,0.7)"
        fontSize={6}
        fontFamily="var(--font-geist-sans)"
      >
        {territory.name}
      </text>
    </g>
  );
}
