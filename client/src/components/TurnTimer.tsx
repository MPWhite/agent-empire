"use client";

interface TurnTimerProps {
  secondsRemaining: number;
  turnNumber: number;
}

export default function TurnTimer({ secondsRemaining, turnNumber }: TurnTimerProps) {
  const isUrgent = secondsRemaining <= 10;
  const pct = Math.min(100, (secondsRemaining / 60) * 100);

  return (
    <div className="flex items-center gap-3">
      <span className="text-zinc-400 text-sm font-mono">Turn {turnNumber}</span>
      <div className="w-32 h-2 bg-zinc-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${
            isUrgent ? "bg-red-500" : "bg-emerald-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={`font-mono text-sm font-bold tabular-nums ${
          isUrgent ? "text-red-600" : "text-zinc-700"
        }`}
      >
        {secondsRemaining}s
      </span>
    </div>
  );
}
