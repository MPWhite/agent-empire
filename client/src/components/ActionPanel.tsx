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
      <div className="p-3">
        <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2 font-mono">
          Actions
        </h3>
        <p className="text-zinc-600 text-xs font-mono">
          SELECT A TERRITORY
        </p>
      </div>
    );
  }

  if (!isOwnTerritory) {
    return (
      <div className="p-3">
        <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2 font-mono">
          Actions
        </h3>
        <p className="text-zinc-600 text-xs font-mono">
          NOT YOUR TERRITORY
        </p>
        <button
          onClick={onClearSelection}
          className="mt-2 text-[10px] text-zinc-600 hover:text-zinc-400 font-mono"
        >
          [CLEAR]
        </button>
      </div>
    );
  }

  return (
    <div className="p-3">
      <h3 className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest mb-2 font-mono">
        {isAttack ? "Attack" : targetTerritory ? "Select Target" : "Reinforce / Attack"}
      </h3>

      <div className="text-xs font-mono mb-2">
        <span style={{ color: gameState.players[playerId]?.color }}>
          {source?.name}
        </span>
        {target && (
          <>
            <span className="text-zinc-600 mx-1">&rarr;</span>
            <span className="text-red-500">{target.name}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <label className="text-[10px] text-zinc-600 font-mono">TROOPS</label>
        <input
          type="range"
          min={1}
          max={Math.max(1, isAttack ? maxTroops : 10)}
          value={troops}
          onChange={(e) => setTroops(parseInt(e.target.value))}
          className="flex-1 accent-emerald-500 h-1"
        />
        <span className="font-mono text-xs text-zinc-300 w-6 text-right">{troops}</span>
      </div>

      <div className="flex gap-2">
        {isAttack ? (
          <button
            onClick={handleSubmit}
            disabled={maxTroops < 1}
            className="flex-1 bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white text-[11px] font-mono font-medium py-1.5 px-3 transition-colors"
          >
            ATTACK ({troops})
          </button>
        ) : !targetTerritory ? (
          <>
            <button
              onClick={handleSubmit}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-mono font-medium py-1.5 px-3 transition-colors"
            >
              REINFORCE (+{troops})
            </button>
            <div className="text-[10px] text-zinc-600 self-center font-mono">
              OR CLICK ENEMY
            </div>
          </>
        ) : null}
        <button
          onClick={onClearSelection}
          className="text-[10px] text-zinc-600 hover:text-zinc-400 px-2 font-mono"
        >
          [X]
        </button>
      </div>
    </div>
  );
}
