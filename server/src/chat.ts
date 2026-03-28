import crypto from 'node:crypto';
import type { TurnPhase } from 'engine';
import type { ChatMessage } from './types.js';
import { CHAT_RATE_LIMITS } from './types.js';
import type { AgentManager } from './agents.js';

export class ChatManager {
  private agentManager: AgentManager;
  /** agentId → last message timestamp */
  private lastMessageTime = new Map<string, number>();

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
  }

  checkRateLimit(agentId: string, currentPhase: TurnPhase): { allowed: boolean; retryAfterMs?: number } {
    const now = Date.now();
    const last = this.lastMessageTime.get(agentId) ?? 0;
    const limit = CHAT_RATE_LIMITS[currentPhase];
    const elapsed = now - last;

    if (elapsed < limit) {
      return { allowed: false, retryAfterMs: limit - elapsed };
    }
    return { allowed: true };
  }

  addMessage(teamId: string, agentId: string, agentName: string, text: string): ChatMessage {
    const teamState = this.agentManager.getTeamState(teamId);
    if (!teamState) throw new Error('Team not found');

    const now = Date.now();
    this.lastMessageTime.set(agentId, now);

    const message: ChatMessage = {
      id: `msg-${crypto.randomBytes(4).toString('hex')}`,
      teamId,
      agentId,
      agentName,
      text,
      timestamp: now,
    };

    teamState.chat.push(message);
    return message;
  }

  addSystemMessage(teamId: string, text: string): ChatMessage {
    const teamState = this.agentManager.getTeamState(teamId);
    if (!teamState) throw new Error('Team not found');

    const message: ChatMessage = {
      id: `msg-${crypto.randomBytes(4).toString('hex')}`,
      teamId,
      agentId: 'system',
      agentName: 'SYSTEM',
      text,
      timestamp: Date.now(),
    };

    teamState.chat.push(message);
    return message;
  }

  getMessages(teamId: string, since: number = 0): ChatMessage[] {
    const teamState = this.agentManager.getTeamState(teamId);
    if (!teamState) return [];
    if (since === 0) return teamState.chat;
    return teamState.chat.filter((m) => m.timestamp > since);
  }
}
