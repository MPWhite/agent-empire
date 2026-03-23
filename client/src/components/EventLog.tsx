"use client";

import { useEffect, useRef } from "react";
import type { GameEvent, SerializedGameState } from "@/lib/types";

interface EventLogProps {
  events: GameEvent[];
  gameState: SerializedGameState;
}

function describeEvent(event: GameEvent, gameState: SerializedGameState): string {
  switch (event.type) {
    case "battle": {
      const attacker = gameState.players[event.attackerId]?.name ?? event.attackerId;
      const defender = gameState.players[event.defenderId]?.name ?? event.defenderId;
      const from = gameState.map.territories[event.fromTerritoryId]?.name ?? event.fromTerritoryId;
      const to = gameState.map.territories[event.toTerritoryId]?.name ?? event.toTerritoryId;
      const result = event.conquered ? "CAPTURED" : `LOST ${event.attackerLosses}/${event.defenderLosses}`;
      return `${attacker} → ${defender} (${from} → ${to}) ${result}`;
    }
    case "conquest": {
      const player = gameState.players[event.playerId]?.name ?? event.playerId;
      const territory = gameState.map.territories[event.territoryId]?.name ?? event.territoryId;
      return `${player} took ${territory} (+${event.troopsMoved})`;
    }
    case "reinforcement": {
      const player = gameState.players[event.playerId]?.name ?? event.playerId;
      const territory = gameState.map.territories[event.territoryId]?.name ?? event.territoryId;
      return `${player} reinforced ${territory} (+${event.troops})`;
    }
    case "elimination": {
      const eliminated = gameState.players[event.playerId]?.name ?? event.playerId;
      const by = gameState.players[event.eliminatedBy]?.name ?? event.eliminatedBy;
      return `${eliminated} ELIMINATED by ${by}`;
    }
    case "victory": {
      const winner = gameState.players[event.playerId]?.name ?? event.playerId;
      return `${winner} WINS`;
    }
  }
}

function eventColor(event: GameEvent): string {
  switch (event.type) {
    case "battle": return event.conquered ? "text-orange-500" : "text-zinc-600";
    case "conquest": return "text-yellow-500";
    case "reinforcement": return "text-emerald-500";
    case "elimination": return "text-red-500";
    case "victory": return "text-amber-400 font-bold";
  }
}

export default function EventLog({ events, gameState }: EventLogProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  return (
    <div className="p-3">
      <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2 font-mono">
        Event Log
      </h3>
      <div className="space-y-0.5 font-mono text-[11px]">
        {events.length === 0 && (
          <p className="text-zinc-700">NO EVENTS</p>
        )}
        {events.slice(-50).map((event, i) => (
          <div key={i} className={eventColor(event)}>
            {describeEvent(event, gameState)}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}
