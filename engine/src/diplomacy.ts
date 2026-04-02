import {
  type Player,
  type ResourceType,
  type AgreementType,
  type Agreement,
  type Sanction,
  type UNResolutionType,
  type UNResolution,
  type ActiveResolution,
  type DiplomaticMessage,
  REPUTATION_MAX,
  REPUTATION_RECOVERY_PER_TURN,
  REPUTATION_NO_TREATIES_THRESHOLD,
  BREAK_TRADE_DEAL_REPUTATION,
  BREAK_NAP_REPUTATION,
  BREAK_ALLIANCE_REPUTATION,
  DIPLOMACY_MESSAGE_BASE_COST,
  DIPLOMACY_MESSAGE_INTEL1_COST,
  RESOURCE_STOCKPILE_CAP,
} from './types.js';

// ── Reputation ──

/** Apply natural reputation recovery (+2/turn, capped at 100) */
export function recoverReputation(player: Player): void {
  player.reputation = Math.min(REPUTATION_MAX, player.reputation + REPUTATION_RECOVERY_PER_TURN);
}

/** Reduce reputation (floored at 0) */
export function reduceReputation(player: Player, amount: number): void {
  player.reputation = Math.max(0, player.reputation - amount);
}

/** Check if player can propose treaties (reputation > 15) */
export function canProposeTreaties(player: Player): boolean {
  return player.reputation > REPUTATION_NO_TREATIES_THRESHOLD;
}

/** Get diplomacy message cost based on intel tech level */
export function getDiplomacyCost(player: Player): number {
  const intel = player.tech.intelligence;
  if (intel >= 3) return 0;
  if (intel >= 1) return DIPLOMACY_MESSAGE_INTEL1_COST;
  return DIPLOMACY_MESSAGE_BASE_COST;
}

// ── Agreements ──

/** Create a new agreement between two players. Generates a unique ID. */
export function createAgreement(
  type: AgreementType,
  party1: string,
  party2: string,
  currentTurn: number,
  duration?: number,
  tradeOffer?: { resource: ResourceType; amount: number },
  tradeRequest?: { resource: ResourceType; amount: number },
): Agreement {
  return {
    id: crypto.randomUUID(),
    type,
    parties: [party1, party2],
    turnsRemaining: duration ?? null,
    createdAtTurn: currentTurn,
    ...(tradeOffer && { tradeOffer }),
    ...(tradeRequest && { tradeRequest }),
  };
}

/** Break an agreement — applies reputation penalty to the breaker */
export function breakAgreement(
  agreement: Agreement,
  breakerId: string,
  player: Player,
): { reputationLost: number } {
  let penalty: number;
  switch (agreement.type) {
    case 'tradeDeal':
      penalty = BREAK_TRADE_DEAL_REPUTATION;
      break;
    case 'nonAggressionPact':
      penalty = BREAK_NAP_REPUTATION;
      break;
    case 'militaryAlliance':
      penalty = BREAK_ALLIANCE_REPUTATION;
      break;
  }
  reduceReputation(player, penalty);
  return { reputationLost: penalty };
}

/** Tick agreements — decrement turnsRemaining, return expired ones */
export function tickAgreements(agreements: Agreement[]): { active: Agreement[]; expired: Agreement[] } {
  const active: Agreement[] = [];
  const expired: Agreement[] = [];

  for (const agreement of agreements) {
    if (agreement.turnsRemaining === null) {
      active.push(agreement);
      continue;
    }
    agreement.turnsRemaining -= 1;
    if (agreement.turnsRemaining <= 0) {
      expired.push(agreement);
    } else {
      active.push(agreement);
    }
  }

  return { active, expired };
}

/** Check if two players have a specific agreement type */
export function hasAgreement(
  agreements: Agreement[],
  player1: string,
  player2: string,
  type?: AgreementType,
): boolean {
  return agreements.some(
    (a) =>
      a.parties.includes(player1) &&
      a.parties.includes(player2) &&
      (type === undefined || a.type === type),
  );
}

/** Get all agreements involving a player */
export function getPlayerAgreements(agreements: Agreement[], playerId: string): Agreement[] {
  return agreements.filter((a) => a.parties.includes(playerId));
}

/** Execute trade deals — transfer resources between parties */
export function executeTradeDeals(agreements: Agreement[], players: Map<string, Player>): void {
  for (const agreement of agreements) {
    if (agreement.type !== 'tradeDeal' || !agreement.tradeOffer || !agreement.tradeRequest) {
      continue;
    }

    const [partyA, partyB] = agreement.parties;
    const playerA = players.get(partyA);
    const playerB = players.get(partyB);

    if (!playerA || !playerB) continue;

    const offerResource = agreement.tradeOffer.resource;
    const offerAmount = agreement.tradeOffer.amount;
    const requestResource = agreement.tradeRequest.resource;
    const requestAmount = agreement.tradeRequest.amount;

    // Check both sides can fulfill
    if (playerA.resources[offerResource] < offerAmount) continue;
    if (playerB.resources[requestResource] < requestAmount) continue;

    // Transfer: A sends offer to B, B sends request to A
    playerA.resources[offerResource] -= offerAmount;
    playerB.resources[offerResource] = Math.min(
      RESOURCE_STOCKPILE_CAP,
      playerB.resources[offerResource] + offerAmount,
    );

    playerB.resources[requestResource] -= requestAmount;
    playerA.resources[requestResource] = Math.min(
      RESOURCE_STOCKPILE_CAP,
      playerA.resources[requestResource] + requestAmount,
    );
  }
}

// ── Sanctions ──

/** Propose a sanction (needs at least 1 supporter besides the proposer) */
export function proposeSanction(targetPlayerId: string, proposerId: string): Sanction {
  return {
    targetPlayerId,
    supporters: [proposerId],
    imposedAtTurn: 0, // set when sanction becomes active
  };
}

/** Add a supporter to a sanction */
export function supportSanction(sanction: Sanction, supporterId: string): boolean {
  if (sanction.supporters.includes(supporterId)) return false;
  if (supporterId === sanction.targetPlayerId) return false;
  sanction.supporters.push(supporterId);
  return true;
}

/** Check if a sanction has enough support (proposer + 1 supporter minimum) */
export function isSanctionActive(sanction: Sanction): boolean {
  return sanction.supporters.length >= 2;
}

/** Check if a player is sanctioned */
export function isPlayerSanctioned(sanctions: Sanction[], playerId: string): boolean {
  return sanctions.some((s) => s.targetPlayerId === playerId && isSanctionActive(s));
}

/** Check if trade is blocked between two players by sanctions */
export function isTradeBlocked(sanctions: Sanction[], player1: string, player2: string): boolean {
  return isPlayerSanctioned(sanctions, player1) || isPlayerSanctioned(sanctions, player2);
}

// ── UN Resolutions ──

/** Create a new UN resolution proposal */
export function createResolution(
  type: UNResolutionType,
  proposedBy: string,
  playerIds: string[],
  details?: UNResolution['details'],
): UNResolution {
  const votes: Record<string, 'yes' | 'no' | null> = {};
  for (const id of playerIds) {
    votes[id] = id === proposedBy ? 'yes' : null;
  }
  return {
    id: crypto.randomUUID(),
    type,
    proposedBy,
    votes,
    turnsToVote: 2,
    ...(details && { details }),
  };
}

/** Cast a vote on a resolution */
export function voteOnResolution(resolution: UNResolution, playerId: string, vote: 'yes' | 'no'): void {
  if (playerId in resolution.votes) {
    resolution.votes[playerId] = vote;
  }
}

/** Check if a resolution has passed (3/4 majority) */
export function hasResolutionPassed(resolution: UNResolution): boolean {
  const voters = Object.values(resolution.votes);
  const totalVoters = voters.length;
  const yesVotes = voters.filter((v) => v === 'yes').length;
  const threshold = Math.ceil(totalVoters * 0.75);
  return yesVotes >= threshold;
}

/** Tick resolutions — decrement turnsToVote, return resolved ones */
export function tickResolutions(resolutions: UNResolution[]): {
  pending: UNResolution[];
  passed: UNResolution[];
  failed: UNResolution[];
} {
  const pending: UNResolution[] = [];
  const passed: UNResolution[] = [];
  const failed: UNResolution[] = [];

  for (const resolution of resolutions) {
    resolution.turnsToVote -= 1;

    if (hasResolutionPassed(resolution)) {
      passed.push(resolution);
    } else if (resolution.turnsToVote <= 0) {
      failed.push(resolution);
    } else {
      pending.push(resolution);
    }
  }

  return { pending, passed, failed };
}

/** Tick active resolutions — decrement turnsRemaining, return expired */
export function tickActiveResolutions(activeResolutions: ActiveResolution[]): {
  active: ActiveResolution[];
  expired: ActiveResolution[];
} {
  const active: ActiveResolution[] = [];
  const expired: ActiveResolution[] = [];

  for (const res of activeResolutions) {
    res.turnsRemaining -= 1;
    if (res.turnsRemaining <= 0) {
      expired.push(res);
    } else {
      active.push(res);
    }
  }

  return { active, expired };
}

/** Check if an active resolution of a type is in effect */
export function isResolutionActive(activeResolutions: ActiveResolution[], type: UNResolutionType): boolean {
  return activeResolutions.some((r) => r.type === type && r.turnsRemaining > 0);
}

// ── Messages ──

const MESSAGE_PUBLIC_DELAY = 3;

/** Create a diplomatic message */
export function createDiplomaticMessage(
  fromPlayerId: string,
  toPlayerId: string,
  text: string,
  currentTurn: number,
): DiplomaticMessage {
  return {
    id: crypto.randomUUID(),
    fromPlayerId,
    toPlayerId,
    text,
    sentAtTurn: currentTurn,
    publicAtTurn: currentTurn + MESSAGE_PUBLIC_DELAY,
    isPublic: false,
  };
}

/** Update message visibility — messages become public after 3 turns */
export function updateMessageVisibility(messages: DiplomaticMessage[], currentTurn: number): void {
  for (const msg of messages) {
    if (!msg.isPublic && currentTurn >= msg.publicAtTurn) {
      msg.isPublic = true;
    }
  }
}

/** Get messages visible to a player (own messages + public ones + spied ones based on intel) */
export function getVisibleMessages(
  messages: DiplomaticMessage[],
  playerId: string,
  hasSpyOnPlayers: string[],
): DiplomaticMessage[] {
  return messages.filter((msg) => {
    // Player's own messages (sent or received)
    if (msg.fromPlayerId === playerId || msg.toPlayerId === playerId) return true;
    // Public messages
    if (msg.isPublic) return true;
    // Spied messages — visible if player has spy network on either party
    if (hasSpyOnPlayers.includes(msg.fromPlayerId) || hasSpyOnPlayers.includes(msg.toPlayerId)) {
      return true;
    }
    return false;
  });
}
