"use client";

import { useEffect, useState } from "react";
import type { TurnPhase } from "../lib/types";

const PHASE_LABELS: Record<TurnPhase, string> = {
  observe: "OBS",
  discuss: "DISC",
  propose: "PROP",
  vote: "VOTE",
  resolve: "RES",
};

const PHASE_LABELS_FULL: Record<TurnPhase, string> = {
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

const PHASE_BG: Record<TurnPhase, string> = {
  observe: "bg-zinc-800",
  discuss: "bg-emerald-900/50",
  propose: "bg-amber-900/50",
  vote: "bg-blue-900/50",
  resolve: "bg-red-900/50",
};

const PHASE_ORDER: TurnPhase[] = ["observe", "discuss", "propose", "vote", "resolve"];

interface CommandBarProps {
  turnNumber: number;
  phase: string;
  turnPhase: TurnPhase | null;
  phaseEndsAt: string | null;
  totalAgents: number;
  hasTeamData: boolean;
  connected: boolean;
  historyActive: boolean;
  onToggleHistory: () => void;
  onWhatIsThis: () => void;
  onRecap?: () => void;
  hasRecapData?: boolean;
}

export function CommandBar({
  turnNumber,
  phase,
  turnPhase,
  phaseEndsAt,
  totalAgents,
  hasTeamData,
  connected,
  historyActive,
  onToggleHistory,
  onWhatIsThis,
  onRecap,
  hasRecapData,
}: CommandBarProps) {
  const [remaining, setRemaining] = useState("");

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

  const activePhase = turnPhase ?? "observe";

  return (
    <header className="flex items-center justify-between px-3 md:px-4 h-10 border-b border-zinc-800 bg-zinc-950 shrink-0">
      {/* Left: Brand + Turn + Phase pipeline */}
      <div className="flex items-center gap-2 md:gap-3 min-w-0">
        <h1 className="text-sm font-bold tracking-wide text-zinc-300 uppercase shrink-0">
          <span className="hidden sm:inline">Agent Empires</span>
          <span className="sm:hidden">AE</span>
        </h1>
        <div className="w-px h-4 bg-zinc-800 shrink-0" />
        <span className="text-zinc-500 text-xs font-mono shrink-0">
          T{turnNumber}
        </span>

        {hasTeamData ? (
          <>
            {/* Phase pipeline */}
            <div className="hidden md:flex items-center gap-0.5">
              {PHASE_ORDER.map((p, i) => {
                const isCurrent = p === activePhase;
                const isPast = PHASE_ORDER.indexOf(activePhase) > i;
                return (
                  <div key={p} className="flex items-center gap-0.5">
                    {i > 0 && <div className="w-1.5 h-px bg-zinc-800" />}
                    <div
                      className={`px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-sm transition-colors ${
                        isCurrent
                          ? `${PHASE_COLORS[p]} ${PHASE_BG[p]}`
                          : isPast
                          ? "text-zinc-600"
                          : "text-zinc-700"
                      }`}
                    >
                      <span className="hidden lg:inline">{PHASE_LABELS_FULL[p]}</span>
                      <span className="lg:hidden">{PHASE_LABELS[p]}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile: just show current phase */}
            <div className={`md:hidden text-[10px] font-mono uppercase ${PHASE_COLORS[activePhase]}`}>
              {PHASE_LABELS_FULL[activePhase]}
            </div>

            {/* Countdown */}
            {remaining && (
              <span className={`text-xs font-mono tabular-nums shrink-0 ${PHASE_COLORS[activePhase]}`}>
                {remaining}
              </span>
            )}
          </>
        ) : (
          <span className="hidden md:inline text-zinc-600 text-xs font-mono">
            PHASE: {phase.toUpperCase()}
          </span>
        )}
      </div>

      {/* Right: Agents + Connection + Actions */}
      <div className="flex items-center gap-2 md:gap-3 shrink-0">
        {hasTeamData && (
          <>
            <div className="hidden md:flex items-center gap-1.5 text-xs font-mono text-zinc-500" title="Active agents">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {totalAgents}
            </div>
            <div className="hidden md:block w-px h-4 bg-zinc-800" />
          </>
        )}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className="hidden md:inline text-xs font-mono text-zinc-600 uppercase">
            {connected ? "Live" : "Off"}
          </span>
        </div>
        <div className="hidden md:block w-px h-4 bg-zinc-800" />
        <a
          href="https://github.com/MPWhite/agent-empire"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:block text-zinc-600 hover:text-zinc-300 transition-colors"
          title="GitHub"
        >
          <svg
            viewBox="0 0 16 16"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
        <a
          href="https://x.com/ttamslam"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:block text-zinc-600 hover:text-zinc-300 transition-colors"
          title="@ttamslam on X"
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
        <div className="hidden md:block w-px h-4 bg-zinc-800" />
        {hasRecapData && (
          <button
            onClick={onRecap}
            className="hidden md:block text-xs font-mono px-1.5 py-0.5 md:px-2 md:py-1 border border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700 transition-colors"
          >
            RECAP
          </button>
        )}
        <button
          onClick={onToggleHistory}
          className={`text-xs font-mono px-1.5 py-0.5 md:px-2 md:py-1 border transition-colors ${
            historyActive
              ? "text-amber-400 border-amber-800 hover:border-amber-700"
              : "text-zinc-600 hover:text-zinc-400 border-zinc-800 hover:border-zinc-700"
          }`}
        >
          {historyActive ? "CLOSE" : "HISTORY"}
        </button>
        <button
          onClick={onWhatIsThis}
          className="text-xs font-mono px-1.5 py-0.5 md:px-2 md:py-1 border border-zinc-800 text-zinc-600 hover:text-zinc-400 hover:border-zinc-700 transition-colors"
          title="What is this?"
        >
          ?
        </button>
      </div>
    </header>
  );
}
