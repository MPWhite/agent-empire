"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage, Player, Proposal } from "../lib/types";

interface TeamChatProps {
  teamId: string;
  player: Player;
  messages: ChatMessage[];
  proposals: Proposal[];
  agentCount: number;
  isSelected: boolean;
  onSelect: () => void;
}

function TeamChatTab({
  player,
  agentCount,
  isSelected,
  onSelect,
  unread,
}: {
  player: Player;
  agentCount: number;
  isSelected: boolean;
  onSelect: () => void;
  unread: number;
}) {
  return (
    <button
      onClick={onSelect}
      className={`flex items-center gap-2 px-3 py-2 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors ${
        isSelected
          ? "border-current text-zinc-100"
          : "border-transparent text-zinc-500 hover:text-zinc-300"
      }`}
      style={{ borderColor: isSelected ? player.color : undefined }}
    >
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: player.color }}
      />
      <span className="truncate">{player.name}</span>
      <span className="text-zinc-600">{agentCount}</span>
      {unread > 0 && !isSelected && (
        <span className="ml-auto w-5 h-5 rounded-full bg-zinc-700 text-zinc-300 text-[10px] flex items-center justify-center">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

function ChatMessageItem({ msg, teamColor }: { msg: ChatMessage; teamColor: string }) {
  const isSystem = msg.agentId === "system";

  if (isSystem) {
    return (
      <div className="px-3 py-1 text-[11px] text-zinc-500 font-mono">
        {msg.text}
      </div>
    );
  }

  return (
    <div className="px-3 py-1.5 hover:bg-zinc-800/50 group">
      <div className="flex items-baseline gap-2">
        <span
          className="text-xs font-mono font-semibold flex-shrink-0"
          style={{ color: teamColor }}
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
}

export function TeamChatPanel({
  players,
  teamChats,
  teamProposals,
  agentCounts,
}: {
  players: Record<string, Player>;
  teamChats: Record<string, ChatMessage[]>;
  teamProposals: Record<string, Proposal[]>;
  agentCounts: Record<string, number>;
}) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [lastSeen, setLastSeen] = useState<Record<string, number>>({});

  // Auto-select first alive team
  const teamIds = Object.keys(players).filter((id) => players[id].isAlive);
  if (!selectedTeam && teamIds.length > 0) {
    setSelectedTeam(teamIds[0]);
  }

  const selectedMessages = selectedTeam ? (teamChats[selectedTeam] ?? []) : [];
  const selectedPlayer = selectedTeam ? players[selectedTeam] : null;

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedMessages.length]);

  // Track last seen count per team for unread badges
  useEffect(() => {
    if (selectedTeam) {
      setLastSeen((prev) => ({
        ...prev,
        [selectedTeam]: (teamChats[selectedTeam] ?? []).length,
      }));
    }
  }, [selectedTeam, teamChats]);

  return (
    <div className="flex flex-col h-full border border-zinc-800 bg-zinc-950">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-800 overflow-x-auto">
        {teamIds.map((teamId) => {
          const msgs = teamChats[teamId] ?? [];
          const seen = lastSeen[teamId] ?? 0;
          const unread = msgs.length - seen;
          return (
            <TeamChatTab
              key={teamId}
              player={players[teamId]}
              agentCount={agentCounts[teamId] ?? 0}
              isSelected={selectedTeam === teamId}
              onSelect={() => setSelectedTeam(teamId)}
              unread={unread}
            />
          );
        })}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto panel-scroll">
        {selectedMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-600 text-xs font-mono">
            AWAITING AGENT COMMUNICATIONS
          </div>
        ) : (
          <div className="py-1">
            {selectedMessages.map((msg) => (
              <ChatMessageItem
                key={msg.id}
                msg={msg}
                teamColor={selectedPlayer?.color ?? "#888"}
              />
            ))}
          </div>
        )}
      </div>

      {/* Proposal summary at bottom */}
      {selectedTeam && (teamProposals[selectedTeam] ?? []).length > 0 && (
        <ProposalBar proposals={teamProposals[selectedTeam]} teamColor={selectedPlayer?.color ?? "#888"} />
      )}
    </div>
  );
}

function ProposalBar({ proposals, teamColor }: { proposals: Proposal[]; teamColor: string }) {
  const sorted = [...proposals].sort((a, b) => b.votes - a.votes);
  const totalVotes = proposals.reduce((sum, p) => sum + p.votes, 0);

  return (
    <div className="border-t border-zinc-800 px-3 py-2">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
          Proposals
        </span>
        <span className="text-[10px] font-mono text-zinc-600">
          {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-1">
        {sorted.slice(0, 5).map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            {/* Vote bar */}
            <div className="flex-1 h-4 bg-zinc-900 rounded-sm overflow-hidden relative">
              <div
                className="h-full rounded-sm transition-all duration-300"
                style={{
                  width: totalVotes > 0 ? `${(p.votes / totalVotes) * 100}%` : "0%",
                  backgroundColor: teamColor,
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
        ))}
      </div>
    </div>
  );
}
