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
}

export default function Territory({
  shape,
  territory,
  owner,
  isSelected,
  isTargetable,
  onClick,
  onHover,
}: TerritoryProps) {
  const fillColor = owner?.color ?? "#374151";
  const fillOpacity = Math.min(0.3 + (territory.troops / 30) * 0.5, 0.8);

  let strokeColor = "#d4d4d8";
  let strokeWidth = 1.5;
  if (isSelected) {
    strokeColor = "#d97706";
    strokeWidth = 3;
  } else if (isTargetable) {
    strokeColor = "#dc2626";
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
        className="transition-all duration-150"
      />
      {/* Troop count */}
      <circle cx={shape.cx} cy={shape.cy} r={14} fill="rgba(0,0,0,0.6)" />
      <text
        x={shape.cx}
        y={shape.cy + 1}
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize={11}
        fontWeight="bold"
        fontFamily="var(--font-geist-mono)"
      >
        {territory.troops}
      </text>
      {/* Territory name (shown small above) */}
      <text
        x={shape.cx}
        y={shape.cy - 20}
        textAnchor="middle"
        fill="rgba(0,0,0,0.5)"
        fontSize={8}
        fontFamily="var(--font-geist-sans)"
      >
        {territory.name}
      </text>
    </g>
  );
}
