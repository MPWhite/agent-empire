"use client";

import type { PlayerAction, SerializedGameState } from "@/lib/types";

interface ActionQueueProps {
  actions: PlayerAction[];
  gameState: SerializedGameState;
  onRemoveAction: (index: number) => void;
}

export default function ActionQueue({ actions, gameState, onRemoveAction }: ActionQueueProps) {
  if (actions.length === 0) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Action Queue
        </h3>
        <p className="text-zinc-500 text-sm italic">
          Click a territory to start planning actions
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
        Action Queue ({actions.length})
      </h3>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {actions.map((action, i) => {
          if (action.type === "attack") {
            const from = gameState.map.territories[action.fromTerritoryId];
            const to = gameState.map.territories[action.toTerritoryId];
            return (
              <div
                key={i}
                className="flex items-center justify-between bg-zinc-50 rounded px-2 py-1.5 text-sm"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-red-600 text-xs font-bold">ATK</span>
                  <span>{from?.name ?? action.fromTerritoryId}</span>
                  <span className="text-zinc-400">→</span>
                  <span>{to?.name ?? action.toTerritoryId}</span>
                  <span className="text-zinc-400 font-mono text-xs">
                    ×{action.troops}
                  </span>
                </div>
                <button
                  onClick={() => onRemoveAction(i)}
                  className="text-zinc-400 hover:text-red-600 text-xs"
                >
                  ✕
                </button>
              </div>
            );
          } else {
            const territory = gameState.map.territories[action.territoryId];
            return (
              <div
                key={i}
                className="flex items-center justify-between bg-zinc-50 rounded px-2 py-1.5 text-sm"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-600 text-xs font-bold">RNF</span>
                  <span>{territory?.name ?? action.territoryId}</span>
                  <span className="text-zinc-400 font-mono text-xs">
                    +{action.troops}
                  </span>
                </div>
                <button
                  onClick={() => onRemoveAction(i)}
                  className="text-zinc-400 hover:text-red-600 text-xs"
                >
                  ✕
                </button>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
}
