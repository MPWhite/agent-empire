"use client";

import { useState } from "react";
import type { SerializedGameState, PlayerAction } from "@/lib/types";

interface ActionPanelProps {
  gameState: SerializedGameState;
  playerId: string;
  selectedTerritory: string | null;
  targetTerritory: string | null;
  onAddAction: (action: PlayerAction) => void;
  onClearSelection: () => void;
}

export default function ActionPanel({
  gameState,
  playerId,
  selectedTerritory,
  targetTerritory,
  onAddAction,
  onClearSelection,
}: ActionPanelProps) {
  const [troops, setTroops] = useState(1);

  const source = selectedTerritory
    ? gameState.map.territories[selectedTerritory]
    : null;
  const target = targetTerritory
    ? gameState.map.territories[targetTerritory]
    : null;

  const isOwnTerritory = source?.ownerId === playerId;
  const isAttack = target && target.ownerId !== playerId;
  const isReinforce = source && !targetTerritory && isOwnTerritory;

  const maxTroops = source ? source.troops - 1 : 0;

  const handleSubmit = () => {
    if (!source || !isOwnTerritory) return;

    if (isAttack && target && targetTerritory) {
      onAddAction({
        type: "attack",
        playerId,
        fromTerritoryId: selectedTerritory!,
        toTerritoryId: targetTerritory,
        troops: Math.min(troops, maxTroops),
      });
    } else if (isReinforce) {
      onAddAction({
        type: "reinforce",
        playerId,
        territoryId: selectedTerritory!,
        troops,
      });
    }

    setTroops(1);
    onClearSelection();
  };

  if (!selectedTerritory) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Actions
        </h3>
        <p className="text-zinc-500 text-sm">
          Select one of your territories to reinforce or attack from
        </p>
      </div>
    );
  }

  if (!isOwnTerritory) {
    return (
      <div className="bg-white border border-zinc-200 rounded-lg p-3">
        <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
          Actions
        </h3>
        <p className="text-zinc-500 text-sm">
          You don&apos;t own {source?.name}. Select one of your territories.
        </p>
        <button
          onClick={onClearSelection}
          className="mt-2 text-xs text-zinc-400 hover:text-zinc-600"
        >
          Clear selection
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-zinc-200 rounded-lg p-3">
      <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
        {isAttack ? "Attack" : targetTerritory ? "Select Target" : "Reinforce / Attack"}
      </h3>

      <div className="text-sm mb-2">
        <span style={{ color: gameState.players[playerId]?.color }}>
          {source?.name}
        </span>
        {target && (
          <>
            <span className="text-zinc-400 mx-1">→</span>
            <span className="text-red-600">{target.name}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <label className="text-xs text-zinc-400">Troops:</label>
        <input
          type="range"
          min={1}
          max={Math.max(1, isAttack ? maxTroops : 10)}
          value={troops}
          onChange={(e) => setTroops(parseInt(e.target.value))}
          className="flex-1 accent-emerald-500"
        />
        <span className="font-mono text-sm w-8 text-right">{troops}</span>
      </div>

      <div className="flex gap-2">
        {isAttack ? (
          <button
            onClick={handleSubmit}
            disabled={maxTroops < 1}
            className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-zinc-200 disabled:text-zinc-400 text-white text-sm font-medium py-1.5 px-3 rounded transition-colors"
          >
            Attack ({troops} troops)
          </button>
        ) : !targetTerritory ? (
          <>
            <button
              onClick={handleSubmit}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium py-1.5 px-3 rounded transition-colors"
            >
              Reinforce (+{troops})
            </button>
            <div className="text-xs text-zinc-400 self-center">
              or click enemy neighbor to attack
            </div>
          </>
        ) : null}
        <button
          onClick={onClearSelection}
          className="text-xs text-zinc-400 hover:text-zinc-600 px-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
