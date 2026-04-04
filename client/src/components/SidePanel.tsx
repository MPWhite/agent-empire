"use client";

import { useState, useEffect, useRef } from "react";
import type { SerializedGameState, AnalystReport, ChatMessage, Proposal, Player, GameEvent, TurnNarrative } from "@/lib/types";
import type { TurnHistoryEntry, PlayerDeltas } from "@/lib/useTurnHistory";
import NewsFeed from "./NewsFeed";
import PlayerDetail from "./PlayerDetail";
import PlayerLeaderboard from "./PlayerLeaderboard";
import { TeamChatPanel } from "./TeamChat";

type DetailTab = "stats" | "comms";

interface SidePanelProps {
  gameState: SerializedGameState;
  reports: AnalystReport[];
  pendingTurns: number;
  selectedPlayerId: string | null;
  onPlayerClick: (playerId: string) => void;
  onClosePlayer: () => void;
  onNewGame: () => void;
  // Turn history for charts
  turnHistory: TurnHistoryEntry[];
  deltas: PlayerDeltas;
  // Team data
  hasTeamData: boolean;
  teamChats: Record<string, ChatMessage[]>;
  teamProposals: Record<string, Proposal[]>;
  agentCounts: Record<string, number>;
  players: Record<string, Player>;
  // Events for feed
  events?: GameEvent[];
  // Narrative
  narrative?: TurnNarrative | null;
  // Mobile
  mobileOpen: boolean;
  onMobileClose: () => void;
  onMobileToggle: () => void;
}

export function SidePanel({
  gameState,
  reports,
  pendingTurns,
  selectedPlayerId,
  onPlayerClick,
  onClosePlayer,
  onNewGame,
  turnHistory,
  deltas,
  hasTeamData,
  teamChats,
  teamProposals,
  agentCounts,
  players,
  events = [],
  narrative,
  mobileOpen,
  onMobileClose,
  onMobileToggle,
}: SidePanelProps) {
  const [detailTab, setDetailTab] = useState<DetailTab>("stats");
  const [unreadComms, setUnreadComms] = useState(0);
  const lastCommsCount = useRef(0);

  // Reset to stats tab when selecting a new player
  useEffect(() => {
    if (selectedPlayerId) setDetailTab("stats");
  }, [selectedPlayerId]);

  // Track unread comms when not viewing comms
  useEffect(() => {
    if (!selectedPlayerId) return;
    const msgs = teamChats[selectedPlayerId] ?? [];
    const count = msgs.length;
    if (detailTab !== "comms") {
      const newMsgs = count - (lastCommsCount.current);
      if (newMsgs > 0) setUnreadComms((prev) => prev + newMsgs);
    } else {
      setUnreadComms(0);
    }
    lastCommsCount.current = count;
  }, [teamChats, selectedPlayerId, detailTab]);

  // Reset unread when player changes
  useEffect(() => {
    setUnreadComms(0);
    if (selectedPlayerId) {
      lastCommsCount.current = (teamChats[selectedPlayerId] ?? []).length;
    }
  }, [selectedPlayerId]);

  const isGameOver = gameState.phase === "finished";
  const selectedPlayer = selectedPlayerId ? players[selectedPlayerId] : null;

  const panelContent = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Leaderboard — always visible at top */}
      <div className="overflow-y-auto panel-scroll shrink-0 max-h-48 border-b border-zinc-800">
        <PlayerLeaderboard
          gameState={gameState}
          onPlayerClick={onPlayerClick}
          selectedPlayerId={selectedPlayerId}
        />
      </div>

      {/* Detail area */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {selectedPlayerId && selectedPlayer ? (
          <>
            {/* Empire header + sub-tabs */}
            <div className="shrink-0 border-b border-zinc-800">
              <div className="flex items-center justify-between px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 shrink-0"
                    style={{ backgroundColor: selectedPlayer.color }}
                  />
                  <span className="text-xs font-bold font-mono text-zinc-200 uppercase tracking-wide">
                    {selectedPlayer.name}
                  </span>
                  {selectedPlayer.isAlive ? (
                    <span className="text-[9px] font-mono bg-emerald-900 text-emerald-400 px-1.5 py-0.5 uppercase">
                      Active
                    </span>
                  ) : (
                    <span className="text-[9px] font-mono bg-red-900 text-red-400 px-1.5 py-0.5 uppercase">
                      Eliminated
                    </span>
                  )}
                </div>
                <button
                  onClick={onClosePlayer}
                  className="text-zinc-600 hover:text-zinc-300 text-xs font-mono px-2 py-1 border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  &times;
                </button>
              </div>

              {/* Stats / Comms sub-tabs */}
              {hasTeamData && (
                <div className="flex border-t border-zinc-800">
                  <SubTab
                    label="STATS"
                    active={detailTab === "stats"}
                    onClick={() => setDetailTab("stats")}
                  />
                  <SubTab
                    label="COMMS"
                    active={detailTab === "comms"}
                    badge={unreadComms}
                    onClick={() => { setDetailTab("comms"); setUnreadComms(0); }}
                  />
                </div>
              )}
            </div>

            {/* Sub-tab content */}
            {detailTab === "stats" || !hasTeamData ? (
              <div className="flex-1 min-h-0 overflow-y-auto panel-scroll">
                <PlayerDetail
                  playerId={selectedPlayerId}
                  gameState={gameState}
                  turnHistory={turnHistory}
                  deltas={deltas}
                  onClose={onClosePlayer}
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <SingleTeamChat
                  teamId={selectedPlayerId}
                  player={selectedPlayer}
                  messages={teamChats[selectedPlayerId] ?? []}
                  proposals={teamProposals[selectedPlayerId] ?? []}
                />
              </div>
            )}
          </>
        ) : isGameOver ? (
          <div className="flex flex-col items-center justify-center gap-4 flex-1">
            <span className="text-amber-500 font-mono font-bold text-sm uppercase tracking-wider">
              Game Over
            </span>
            <button
              onClick={onNewGame}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-medium py-1.5 px-4 transition-colors"
            >
              NEW GAME
            </button>
          </div>
        ) : (
          /* Default: War Desk reports + event feed */
          <NewsFeed
            reports={reports}
            currentTurn={gameState.turnNumber}
            pendingTurns={pendingTurns}
            events={events}
            players={players}
            territories={gameState.map.territories}
            narrative={narrative}
          />
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop side panel */}
      <div className="hidden lg:flex flex-col w-[340px] xl:w-[380px] border-l border-zinc-800 bg-zinc-950 h-full shrink-0 overflow-hidden">
        {panelContent}
      </div>

      {/* Mobile */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30">
        {/* Bottom sheet */}
        {mobileOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-30"
              onClick={onMobileClose}
            />
            <div
              className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950 border-t border-zinc-800 animate-slide-up"
              style={{ height: "75vh" }}
            >
              <div className="flex items-center justify-center py-2">
                <div className="w-10 h-1 rounded-full bg-zinc-700" />
              </div>
              <div className="h-[calc(100%-2rem)] overflow-hidden">
                {panelContent}
              </div>
            </div>
          </>
        )}

        {/* Floating toggle button */}
        {!mobileOpen && (
          <div className="flex justify-center pb-4 pt-2 pointer-events-none">
            <button
              onClick={onMobileToggle}
              className="bg-zinc-900/95 backdrop-blur-sm border border-zinc-700 rounded-full pointer-events-auto shadow-lg px-5 py-2 text-xs font-mono text-zinc-300 hover:text-zinc-100 transition-colors"
            >
              SHOW INFO
            </button>
          </div>
        )}
      </div>
    </>
  );
}

/** Single team's chat for the Comms sub-tab (no team tab switching needed) */
function SingleTeamChat({
  teamId,
  player,
  messages,
  proposals,
}: {
  teamId: string;
  player: Player;
  messages: ChatMessage[];
  proposals: Proposal[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto panel-scroll">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-xs font-mono">
            NO COMMS INTERCEPTED
          </div>
        ) : (
          <div className="py-1">
            {messages.map((msg) => {
              const isSystem = msg.agentId === "system";
              if (isSystem) {
                return (
                  <div key={msg.id} className="px-3 py-1 text-[11px] text-zinc-500 font-mono">
                    {msg.text}
                  </div>
                );
              }
              return (
                <div key={msg.id} className="px-3 py-1.5 hover:bg-zinc-800/50">
                  <div className="flex items-baseline gap-2">
                    <span
                      className="text-xs font-mono font-semibold shrink-0"
                      style={{ color: player.color }}
                    >
                      {msg.agentName}
                    </span>
                    <span className="text-[10px] text-zinc-600 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 mt-0.5 leading-snug break-words">
                    {msg.text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Proposals */}
      {proposals.length > 0 && (
        <div className="border-t border-zinc-800 px-3 py-2 shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
              Proposals
            </span>
            <span className="text-[10px] font-mono text-zinc-600">
              {proposals.reduce((s, p) => s + p.votes, 0)} votes
            </span>
          </div>
          <div className="space-y-1">
            {[...proposals].sort((a, b) => b.votes - a.votes).slice(0, 5).map((p) => {
              const totalVotes = proposals.reduce((s, pr) => s + pr.votes, 0);
              return (
                <div key={p.id} className="flex items-center gap-2">
                  <div className="flex-1 h-4 bg-zinc-900 rounded-sm overflow-hidden relative">
                    <div
                      className="h-full rounded-sm transition-all duration-300"
                      style={{
                        width: totalVotes > 0 ? `${(p.votes / totalVotes) * 100}%` : "0%",
                        backgroundColor: player.color,
                        opacity: 0.6,
                      }}
                    />
                    <span className="absolute inset-0 flex items-center px-1.5 text-[10px] font-mono text-zinc-200 truncate">
                      {p.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 w-6 text-right">
                    {p.votes}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SubTab({
  label,
  active,
  badge,
  onClick,
}: {
  label: string;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors ${
        active
          ? "text-zinc-100 border-b-2 border-zinc-100"
          : "text-zinc-500 hover:text-zinc-300 border-b-2 border-transparent"
      }`}
    >
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1.5 inline-flex w-4 h-4 rounded-full bg-red-500/80 text-[9px] text-white items-center justify-center">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </button>
  );
}
