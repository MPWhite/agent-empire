"use client";

import { useEffect, useState } from "react";
import type { TurnPhase } from "../lib/types";

const PHASE_LABELS: Record<TurnPhase, string> = {
  observe: "OBSERVE",
  discuss: "DISCUSS",
  propose: "PROPOSE",
  vote: "VOTE",
  resolve: "RESOLVE",
};

const PHASE_COLORS: Record<TurnPhase, string> = {
  observe: "text-zinc-400",
  discuss: "text-emerald-400",
  propose: "text-amber-400",
  vote: "text-blue-400",
  resolve: "text-red-400",
};

const PHASE_ORDER: TurnPhase[] = ["observe", "discuss", "propose", "vote", "resolve"];

export function PhaseTimer({
  turnNumber,
  turnPhase,
  phaseEndsAt,
  totalAgents,
}: {
  turnNumber: number;
  turnPhase: TurnPhase | null;
  phaseEndsAt: string | null;
  totalAgents: number;
}) {
  const [remaining, setRemaining] = useState<string>("");

  useEffect(() => {
    if (!phaseEndsAt) return;

    const tick = () => {
      const end = new Date(phaseEndsAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, end - now);
      const mins = Math.floor(diff / 60_000);
      const secs = Math.floor((diff % 60_000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [phaseEndsAt]);

  const phase = turnPhase ?? "observe";

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-800 bg-zinc-950">
      {/* Turn number */}
      <div className="text-xs font-mono text-zinc-500">
        TURN <span className="text-zinc-200">{turnNumber}</span>
      </div>

      {/* Phase indicators */}
      <div className="flex items-center gap-1">
        {PHASE_ORDER.map((p, i) => {
          const isCurrent = p === phase;
          const isPast = PHASE_ORDER.indexOf(phase) > i;
          return (
            <div key={p} className="flex items-center gap-1">
              {i > 0 && <div className="w-2 h-px bg-zinc-800" />}
              <div
                className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-sm transition-colors ${
                  isCurrent
                    ? `${PHASE_COLORS[p]} bg-zinc-800`
                    : isPast
                    ? "text-zinc-600"
                    : "text-zinc-700"
                }`}
              >
                {PHASE_LABELS[p]}
              </div>
            </div>
          );
        })}
      </div>

      {/* Countdown */}
      <div className={`text-sm font-mono tabular-nums ${PHASE_COLORS[phase]}`}>
        {remaining}
      </div>

      {/* Agent count */}
      <div className="ml-auto flex items-center gap-1.5 text-xs font-mono text-zinc-500">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {totalAgents} agent{totalAgents !== 1 ? "s" : ""}
      </div>
    </div>
  );
}
