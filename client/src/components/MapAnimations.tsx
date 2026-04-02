"use client";

import { useState, useEffect, useRef } from "react";
import type { GameEvent, NukeEvent, MissileStrikeEvent, SpyEvent, DiplomacyEvent } from "@/lib/types";
import { TERRITORY_SHAPES } from "@/lib/map-paths";

interface MapAnimationsProps {
  events: GameEvent[];
  playerCapitals: Map<string, string>; // playerId → territoryId (most troops)
}

interface ActiveAnimation {
  id: string;
  type: 'nuke' | 'missile' | 'spy' | 'diplomacy';
  startTime: number;
  duration: number;
  data: Record<string, unknown>;
}

const shapeMap = new Map(TERRITORY_SHAPES.map((s) => [s.id, s]));

function getTerritoryCentroid(tid: string): { cx: number; cy: number } | null {
  return shapeMap.get(tid) ?? null;
}

export default function MapAnimations({ events, playerCapitals }: MapAnimationsProps) {
  const [animations, setAnimations] = useState<ActiveAnimation[]>([]);
  const processedRef = useRef(0);
  const animIdRef = useRef(0);

  // Queue new animations when events arrive
  useEffect(() => {
    if (events.length <= processedRef.current) return;
    const newEvents = events.slice(processedRef.current);
    processedRef.current = events.length;

    const newAnims: ActiveAnimation[] = [];
    for (const evt of newEvents) {
      const id = `anim-${animIdRef.current++}`;
      if (evt.type === 'nuke') {
        const nuke = evt as NukeEvent;
        newAnims.push({ id, type: 'nuke', startTime: Date.now(), duration: 2500, data: { targetTerritoryId: nuke.targetTerritoryId, collateralTerritories: nuke.collateralTerritories } });
      } else if (evt.type === 'missileStrike') {
        const missile = evt as MissileStrikeEvent;
        newAnims.push({ id, type: 'missile', startTime: Date.now(), duration: 1500, data: { targetTerritoryId: missile.targetTerritoryId, attackerId: missile.attackerId } });
      } else if (evt.type === 'spyEvent') {
        const spy = evt as SpyEvent;
        const targetCapital = playerCapitals.get(spy.targetId);
        if (targetCapital) {
          newAnims.push({ id, type: 'spy', startTime: Date.now(), duration: 1200, data: { targetTerritoryId: targetCapital } });
        }
      } else if (evt.type === 'diplomacyEvent') {
        const dip = evt as DiplomacyEvent;
        if (dip.subtype === 'agreementFormed' && dip.targetPlayerId) {
          const c1 = playerCapitals.get(dip.playerId);
          const c2 = playerCapitals.get(dip.targetPlayerId);
          if (c1 && c2) {
            newAnims.push({ id, type: 'diplomacy', startTime: Date.now(), duration: 1500, data: { from: c1, to: c2 } });
          }
        }
      }
    }

    if (newAnims.length > 0) {
      setAnimations((prev) => [...prev, ...newAnims]);
    }
  }, [events.length, playerCapitals]);

  // Cleanup expired animations
  useEffect(() => {
    if (animations.length === 0) return;
    const timer = setInterval(() => {
      const now = Date.now();
      setAnimations((prev) => prev.filter((a) => now - a.startTime < a.duration));
    }, 200);
    return () => clearInterval(timer);
  }, [animations.length]);

  if (animations.length === 0) return null;

  return (
    <g className="map-animations" style={{ pointerEvents: 'none' }}>
      {animations.map((anim) => {
        const progress = Math.min((Date.now() - anim.startTime) / anim.duration, 1);

        if (anim.type === 'nuke') {
          const center = getTerritoryCentroid(anim.data.targetTerritoryId as string);
          if (!center) return null;
          const radius = 10 + progress * 80;
          const opacity = 1 - progress;
          return (
            <g key={anim.id}>
              <circle
                cx={center.cx}
                cy={center.cy}
                r={radius}
                fill="none"
                stroke="#fbbf24"
                strokeWidth={3 - progress * 2}
                opacity={opacity}
              />
              <circle
                cx={center.cx}
                cy={center.cy}
                r={radius * 0.6}
                fill="#fbbf24"
                opacity={opacity * 0.2}
              />
              {/* Collateral flashes */}
              {(anim.data.collateralTerritories as string[]).map((tid) => {
                const c = getTerritoryCentroid(tid);
                if (!c) return null;
                return (
                  <circle
                    key={tid}
                    cx={c.cx}
                    cy={c.cy}
                    r={8 + progress * 20}
                    fill="#fbbf24"
                    opacity={(1 - progress) * 0.15}
                  />
                );
              })}
            </g>
          );
        }

        if (anim.type === 'missile') {
          const target = getTerritoryCentroid(anim.data.targetTerritoryId as string);
          const attackerCapital = playerCapitals.get(anim.data.attackerId as string);
          const source = attackerCapital ? getTerritoryCentroid(attackerCapital) : null;
          if (!target) return null;

          if (source && progress < 0.7) {
            // Arc from source to target
            const t = progress / 0.7;
            const midX = (source.cx + target.cx) / 2;
            const midY = Math.min(source.cy, target.cy) - 40;
            const x = (1 - t) * (1 - t) * source.cx + 2 * (1 - t) * t * midX + t * t * target.cx;
            const y = (1 - t) * (1 - t) * source.cy + 2 * (1 - t) * t * midY + t * t * target.cy;
            return (
              <circle
                key={anim.id}
                cx={x}
                cy={y}
                r={4}
                fill="#f97316"
                opacity={0.9}
              />
            );
          }
          // Impact burst
          const burstProgress = (progress - 0.7) / 0.3;
          return (
            <circle
              key={anim.id}
              cx={target.cx}
              cy={target.cy}
              r={5 + burstProgress * 30}
              fill="#f97316"
              opacity={(1 - burstProgress) * 0.4}
            />
          );
        }

        if (anim.type === 'spy') {
          const center = getTerritoryCentroid(anim.data.targetTerritoryId as string);
          if (!center) return null;
          const opacity = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
          return (
            <text
              key={anim.id}
              x={center.cx}
              y={center.cy}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={20}
              opacity={opacity}
              fill="#a78bfa"
            >
              👁
            </text>
          );
        }

        if (anim.type === 'diplomacy') {
          const from = getTerritoryCentroid(anim.data.from as string);
          const to = getTerritoryCentroid(anim.data.to as string);
          if (!from || !to) return null;
          const opacity = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
          return (
            <line
              key={anim.id}
              x1={from.cx}
              y1={from.cy}
              x2={to.cx}
              y2={to.cy}
              stroke="#34d399"
              strokeWidth={2}
              opacity={opacity}
            />
          );
        }

        return null;
      })}
    </g>
  );
}
