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
      const result = event.conquered ? "conquered!" : `lost ${event.attackerLosses}/${event.defenderLosses}`;
      return `${attacker} attacked ${defender} (${from} → ${to}) — ${result}`;
    }
    case "conquest": {
      const player = gameState.players[event.playerId]?.name ?? event.playerId;
      const territory = gameState.map.territories[event.territoryId]?.name ?? event.territoryId;
      return `${player} conquered ${territory} (${event.troopsMoved} troops moved in)`;
    }
    case "reinforcement": {
      const player = gameState.players[event.playerId]?.name ?? event.playerId;
      const territory = gameState.map.territories[event.territoryId]?.name ?? event.territoryId;
      return `${player} reinforced ${territory} (+${event.troops})`;
    }
    case "elimination": {
      const eliminated = gameState.players[event.playerId]?.name ?? event.playerId;
      const by = gameState.players[event.eliminatedBy]?.name ?? event.eliminatedBy;
      return `${eliminated} was eliminated by ${by}!`;
    }
    case "victory": {
      const winner = gameState.players[event.playerId]?.name ?? event.playerId;
      return `${winner} wins the game!`;
    }
  }
}

function eventColor(event: GameEvent): string {
  switch (event.type) {
    case "battle": return event.conquered ? "text-orange-600" : "text-zinc-500";
    case "conquest": return "text-yellow-600";
    case "reinforcement": return "text-emerald-600";
    case "elimination": return "text-red-600";
    case "victory": return "text-amber-600 font-bold";
  }
}

export default function EventLog({ events, gameState }: EventLogProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
        Event Log
      </h3>
      <div className="max-h-48 overflow-y-auto space-y-0.5 font-mono text-xs">
        {events.length === 0 && (
          <p className="text-zinc-400 italic">No events yet</p>
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
