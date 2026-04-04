"use client";

import type { CommsHighlight, Player } from "@/lib/types";

interface CommsHighlightCardProps {
  highlight: CommsHighlight;
  turnNumber: number;
  players: Record<string, Player>;
}

export default function CommsHighlightCard({ highlight, turnNumber, players }: CommsHighlightCardProps) {
  const teamPlayer = players[highlight.teamId];
  const teamColor = teamPlayer?.color ?? '#888';

  return (
    <div
      className="border-t border-zinc-800/50"
      style={{ borderLeftWidth: 3, borderLeftStyle: 'solid', borderLeftColor: '#34d399' }}
    >
      <div className="px-3 py-2" style={{ backgroundColor: 'rgba(6, 95, 70, 0.05)' }}>
        {/* Header */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs">💬</span>
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
            {highlight.headline}
          </span>
          <span className="text-[7px] font-mono text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded uppercase ml-1">
            Comms
          </span>
          <span className="text-[9px] font-mono text-zinc-600 ml-auto">
            Turn {turnNumber}
          </span>
        </div>

        {/* Quotes */}
        <div className="flex flex-col gap-1 mb-2">
          {highlight.quotes.map((quote, i) => {
            const quotePlayer = players[quote.teamId];
            const color = quotePlayer?.color ?? teamColor;
            return (
              <div key={i} className="flex items-start gap-1.5">
                <div
                  className="w-4 h-4 rounded-full shrink-0 mt-0.5 flex items-center justify-center text-[7px] font-bold text-white"
                  style={{ backgroundColor: color }}
                >
                  {quote.agentName.charAt(0).toUpperCase()}
                </div>
                <div className="bg-zinc-800/50 px-2 py-1 rounded text-[10px] text-zinc-400 leading-relaxed">
                  &ldquo;{quote.text}&rdquo;
                </div>
              </div>
            );
          })}
        </div>

        {/* Context line */}
        <div
          className="text-[10px] leading-relaxed px-2.5 py-2 rounded-r"
          style={{
            color: '#c4b5fd',
            backgroundColor: 'rgba(46, 16, 101, 0.15)',
            borderLeft: '2px solid rgba(124, 58, 237, 0.3)',
          }}
        >
          {highlight.context}
        </div>
      </div>
    </div>
  );
}
