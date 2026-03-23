"use client";

import type { PlayerAction, SerializedGameState } from "@/lib/types";

interface ActionQueueProps {
  actions: PlayerAction[];
  gameState: SerializedGameState;
  onRemoveAction: (index: number) => void;
}

export default function ActionQueue({ actions, gameState, onRemoveAction }: ActionQueueProps) {
  return (
    <div className="p-3">
      <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2 font-mono">
        Queue ({actions.length})
      </h3>
      {actions.length === 0 ? (
        <p className="text-zinc-700 text-xs font-mono">NO ACTIONS QUEUED</p>
      ) : (
        <div className="space-y-1">
          {actions.map((action, i) => {
            if (action.type === "attack") {
              const from = gameState.map.territories[action.fromTerritoryId];
              const to = gameState.map.territories[action.toTerritoryId];
              return (
                <div
                  key={i}
                  className="flex items-center justify-between bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-[11px] font-mono"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-red-500 font-bold">ATK</span>
                    <span className="text-zinc-400">{from?.name ?? action.fromTerritoryId}</span>
                    <span className="text-zinc-700">&rarr;</span>
                    <span className="text-zinc-400">{to?.name ?? action.toTerritoryId}</span>
                    <span className="text-zinc-600">x{action.troops}</span>
                  </div>
                  <button
                    onClick={() => onRemoveAction(i)}
                    className="text-zinc-700 hover:text-red-500 text-xs"
                  >
                    x
                  </button>
                </div>
              );
            } else {
              const territory = gameState.map.territories[action.territoryId];
              return (
                <div
                  key={i}
                  className="flex items-center justify-between bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-[11px] font-mono"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-500 font-bold">RNF</span>
                    <span className="text-zinc-400">{territory?.name ?? action.territoryId}</span>
                    <span className="text-zinc-600">+{action.troops}</span>
                  </div>
                  <button
                    onClick={() => onRemoveAction(i)}
                    className="text-zinc-700 hover:text-red-500 text-xs"
                  >
                    x
                  </button>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
