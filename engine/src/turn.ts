import type {
  GameState,
  GameEvent,
  PlayerAction,
  AttackAction,
  ReinforceAction,
  ResearchAction,
  BuildFortAction,
  LaunchMissileAction,
  LaunchNukeAction,
  TradeAction,
  SanctionAction,
  SpyAction,
  CyberattackAction,
  DiplomacyAction,
  TurnResult,
  Territory,
  Resources,
  TechProgress,
  Agreement,
  Player,
} from './types.js';
import {
  DOMINANCE_THRESHOLD,
  MAX_TURNS,
  EMPTY_RESOURCES,
  RESOURCE_STOCKPILE_CAP,
  FORT_MINERAL_COST,
  TROOP_MONEY_COST,
  SHORTAGE_WARNING_TURNS,
  SHORTAGE_PENALTY_TURNS,
  SHORTAGE_CRITICAL_TURNS,
  REPUTATION_RECOVERY_PER_TURN,
  REPUTATION_MAX,
  REPUTATION_DEFECTION_THRESHOLD,
} from './types.js';
import { validateAction, validateAttackDuringResolution } from './validation.js';
import { resolveCombat, resolveCombatWithModifiers, calculateAllianceDefense } from './combat.js';
import { createBattleEvent } from './combat.js';
import { calculateReinforcements, deductReinforcementCost } from './reinforcements.js';
import { getPlayerTerritories } from './map.js';
import { resolveMissile } from './actions/missile.js';
import { resolveNuke } from './actions/nuke.js';
import { resolveSpy, resolveCyberattack } from './actions/spy.js';
import { generateEvent, applyEvent, tickEvents, scheduleNextEvent } from './events.js';

/**
 * Deep-clone a GameState so we can mutate freely.
 */
function cloneState(state: GameState): GameState {
  const territories = new Map<string, Territory>();
  for (const [id, t] of state.map.territories) {
    territories.set(id, { ...t, resources: { ...t.resources } });
  }

  const players = new Map<string, Player>();
  for (const [id, p] of state.players) {
    players.set(id, {
      ...p,
      resources: { ...p.resources },
      tech: { ...p.tech },
      shortages: { ...p.shortages },
    });
  }

  const techProgress = new Map<string, TechProgress>();
  for (const [id, tp] of state.techProgress) {
    techProgress.set(id, { ...tp });
  }

  return {
    map: {
      territories,
      continents: state.map.continents,
      adjacency: state.map.adjacency,
    },
    players,
    turnNumber: state.turnNumber,
    phase: state.phase,
    techProgress,
    agreements: state.agreements.map((a) => ({ ...a, parties: [...a.parties] as [string, string] })),
    sanctions: state.sanctions.map((s) => ({ ...s, supporters: [...s.supporters] })),
    diplomaticMessages: state.diplomaticMessages.map((m) => ({ ...m })),
    unResolutions: state.unResolutions.map((r) => ({ ...r, votes: { ...r.votes }, details: r.details ? { ...r.details } : undefined })),
    activeResolutions: state.activeResolutions.map((r) => ({ ...r, details: r.details ? { ...r.details } : undefined })),
    events: state.events.map((e) => ({ ...e, details: e.details ? { ...e.details } : undefined })),
    nextEventTurn: state.nextEventTurn,
  };
}

/**
 * Shuffle array in-place using Fisher-Yates with a seeded approach.
 */
function shuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Calculate resource production for a player from their territories.
 */
function calculateProduction(state: GameState, playerId: string): Resources {
  const production: Resources = { ...EMPTY_RESOURCES };
  const player = state.players.get(playerId)!;

  for (const [, territory] of state.map.territories) {
    if (territory.ownerId !== playerId) continue;
    if (territory.falloutTurns > 0) continue; // Nuclear fallout = no production

    const res = territory.resources;
    if (res.oil) production.oil += res.oil;
    if (res.minerals) production.minerals += res.minerals;
    if (res.food) production.food += res.food;
    if (res.money) production.money += res.money;
  }

  // Oil Shock event: halve oil production
  const oilShockActive = state.events.some(
    (e) => e.type === 'oilShock' && e.activeAtTurn <= state.turnNumber && e.turnsRemaining > 0,
  );
  if (oilShockActive) {
    production.oil = Math.floor(production.oil / 2);
  }

  // Famine event: zero food in affected continent
  for (const event of state.events) {
    if (event.type === 'famine' && event.activeAtTurn <= state.turnNumber && event.turnsRemaining > 0) {
      const continentId = event.details?.targetContinentId;
      if (continentId) {
        // Recalculate food without the famine continent
        let foodLost = 0;
        for (const [, t] of state.map.territories) {
          if (t.ownerId === playerId && t.continentId === continentId && t.falloutTurns <= 0) {
            foodLost += t.resources.food ?? 0;
          }
        }
        production.food = Math.max(0, production.food - foodLost);
      }
    }
  }

  // Economic Tech level 2: Resource Extraction (+50%)
  if (player.tech.economic >= 2) {
    production.oil = Math.floor(production.oil * 1.5);
    production.minerals = Math.floor(production.minerals * 1.5);
    production.food = Math.floor(production.food * 1.5);
    production.money = Math.floor(production.money * 1.5);
  }

  return production;
}

/**
 * Main turn resolution pipeline (v2):
 *
 * 1.  Resource production
 * 2.  Trade deal execution
 * 3.  Research applied
 * 4.  Reinforcements placed (costs money)
 * 5.  Fortifications built
 * 6.  Spy operations resolve
 * 7.  Cyberattacks resolve
 * 8.  Missile strikes resolve
 * 9.  Nuclear strikes + MAD retaliation
 * 10. Ground attacks resolve (shuffled)
 * 11. Diplomatic actions resolve
 * 12. Sanctions checked
 * 13. UN resolutions voted and enforced
 * 14. Shortage counters updated
 * 15. World events, elimination/dominance/timer checks
 */
export function resolveTurn(
  state: GameState,
  actions: PlayerAction[],
): TurnResult {
  const newState = cloneState(state);
  const events: GameEvent[] = [];

  // Categorize actions by type
  const reinforceActions: ReinforceAction[] = [];
  const attackActions: AttackAction[] = [];
  const researchActions: ResearchAction[] = [];
  const buildFortActions: BuildFortAction[] = [];
  const missileActions: LaunchMissileAction[] = [];
  const nukeActions: LaunchNukeAction[] = [];
  const tradeActions: TradeAction[] = [];
  const sanctionActions: SanctionAction[] = [];
  const spyActions: SpyAction[] = [];
  const cyberActions: CyberattackAction[] = [];
  const diplomacyActions: DiplomacyAction[] = [];

  for (const action of actions) {
    const validation = validateAction(state, action);
    if (!validation.valid) continue;

    switch (action.type) {
      case 'reinforce': reinforceActions.push(action); break;
      case 'attack': attackActions.push(action); break;
      case 'research': researchActions.push(action); break;
      case 'buildFort': buildFortActions.push(action); break;
      case 'launchMissile': missileActions.push(action); break;
      case 'launchNuke': nukeActions.push(action); break;
      case 'trade': tradeActions.push(action); break;
      case 'sanction': sanctionActions.push(action); break;
      case 'spy': spyActions.push(action); break;
      case 'cyberattack': cyberActions.push(action); break;
      case 'diplomacy': diplomacyActions.push(action); break;
    }
  }

  // ── Step 1: Resource Production ──
  for (const [playerId, player] of newState.players) {
    if (!player.isAlive) continue;

    const production = calculateProduction(newState, playerId);

    // Apply production (capped at RESOURCE_STOCKPILE_CAP)
    player.resources.oil = Math.min(RESOURCE_STOCKPILE_CAP, player.resources.oil + production.oil);
    player.resources.minerals = Math.min(RESOURCE_STOCKPILE_CAP, player.resources.minerals + production.minerals);
    player.resources.food = Math.min(RESOURCE_STOCKPILE_CAP, player.resources.food + production.food);
    player.resources.money = Math.min(RESOURCE_STOCKPILE_CAP, player.resources.money + production.money);

    events.push({
      type: 'resourceProduction',
      playerId,
      produced: production,
    });
  }

  // Tick fallout timers
  for (const [, territory] of newState.map.territories) {
    if (territory.falloutTurns > 0) {
      territory.falloutTurns--;
    }
  }

  // ── Step 2: Trade Deal Execution ──
  for (const agreement of newState.agreements) {
    if (agreement.type !== 'tradeDeal') continue;
    if (!agreement.tradeOffer || !agreement.tradeRequest) continue;

    const [p1Id, p2Id] = agreement.parties;
    const p1 = newState.players.get(p1Id);
    const p2 = newState.players.get(p2Id);
    if (!p1 || !p2 || !p1.isAlive || !p2.isAlive) continue;

    // Check sanctions don't block this trade
    const blocked = newState.sanctions.some(
      (s) =>
        (s.targetPlayerId === p1Id || s.targetPlayerId === p2Id) &&
        s.supporters.length >= 1,
    );
    if (blocked) continue;

    // P1 gives offer, P2 gives request
    const offerRes = agreement.tradeOffer.resource;
    const offerAmt = Math.min(agreement.tradeOffer.amount, p1.resources[offerRes]);
    const reqRes = agreement.tradeRequest.resource;
    const reqAmt = Math.min(agreement.tradeRequest.amount, p2.resources[reqRes]);

    p1.resources[offerRes] -= offerAmt;
    p2.resources[offerRes] = Math.min(RESOURCE_STOCKPILE_CAP, p2.resources[offerRes] + offerAmt);
    p2.resources[reqRes] -= reqAmt;
    p1.resources[reqRes] = Math.min(RESOURCE_STOCKPILE_CAP, p1.resources[reqRes] + reqAmt);
  }

  // ── Step 3: Research ──
  for (const action of researchActions) {
    const player = newState.players.get(action.playerId);
    if (!player || !player.isAlive) continue;

    const progress = newState.techProgress.get(action.playerId);
    if (!progress) continue;

    const currentLevel = player.tech[action.branch];
    if (currentLevel >= 5) continue;

    // Cost: 1 mineral + 1 money per research point
    const affordable = Math.min(action.investment, player.resources.minerals, player.resources.money);
    if (affordable < 1) continue;

    player.resources.minerals -= affordable;
    player.resources.money -= affordable;

    // Arms Race event doubles research speed
    const armsRaceActive = newState.events.some(
      (e) => e.type === 'armsRace' && e.activeAtTurn <= newState.turnNumber && e.turnsRemaining > 0,
    );
    const effectiveInvestment = armsRaceActive ? affordable * 2 : affordable;

    progress[action.branch] += effectiveInvestment;

    // Check for level-up (thresholds: 5, 10, 20, 35, 50)
    const thresholds = [0, 5, 10, 20, 35, 50]; // index = level
    const nextLevel = currentLevel + 1;
    if (nextLevel <= 5 && progress[action.branch] >= thresholds[nextLevel]) {
      player.tech[action.branch] = nextLevel;
      // Carry over excess progress
      progress[action.branch] -= thresholds[nextLevel];
      events.push({
        type: 'research',
        playerId: action.playerId,
        branch: action.branch,
        newLevel: nextLevel,
      });
    }
  }

  // ── Step 4: Reinforcements ──
  const reinforcementBudgets = new Map<string, number>();
  for (const [playerId, player] of newState.players) {
    if (player.isAlive) {
      reinforcementBudgets.set(playerId, calculateReinforcements(newState, playerId));
    }
  }

  const reinforcementsUsed = new Map<string, number>();
  for (const action of reinforceActions) {
    const budget = reinforcementBudgets.get(action.playerId) ?? 0;
    const used = reinforcementsUsed.get(action.playerId) ?? 0;
    const available = budget - used;
    if (available <= 0) continue;

    const troopsToAdd = Math.min(action.troops, available);
    const territory = newState.map.territories.get(action.territoryId)!;
    territory.troops += troopsToAdd;
    reinforcementsUsed.set(action.playerId, used + troopsToAdd);

    // Deduct money
    const player = newState.players.get(action.playerId)!;
    player.resources.money -= troopsToAdd * TROOP_MONEY_COST;

    events.push({
      type: 'reinforcement',
      playerId: action.playerId,
      territoryId: action.territoryId,
      troops: troopsToAdd,
    });
  }

  // Distribute unspent reinforcements evenly
  for (const [playerId, budget] of reinforcementBudgets) {
    const used = reinforcementsUsed.get(playerId) ?? 0;
    let remaining = budget - used;
    if (remaining <= 0) continue;

    const player = newState.players.get(playerId)!;
    const ownedTerritories = getPlayerTerritories(newState.map, playerId);
    if (ownedTerritories.length === 0) continue;

    let idx = 0;
    while (remaining > 0) {
      const territory = newState.map.territories.get(ownedTerritories[idx % ownedTerritories.length].id)!;
      territory.troops += 1;
      player.resources.money -= TROOP_MONEY_COST;
      remaining--;
      idx++;
    }
  }

  // ── Step 5: Build Fortifications ──
  for (const action of buildFortActions) {
    const player = newState.players.get(action.playerId);
    if (!player || !player.isAlive) continue;
    if (player.tech.military < 1) continue;
    if (player.resources.minerals < FORT_MINERAL_COST) continue;

    const territory = newState.map.territories.get(action.territoryId);
    if (!territory || territory.ownerId !== action.playerId) continue;
    if (territory.fortLevel >= 3) continue;

    player.resources.minerals -= FORT_MINERAL_COST;
    territory.fortLevel++;
  }

  // ── Step 6: Spy Operations ──
  for (const action of spyActions) {
    const event = resolveSpy(newState, action);
    if (event) events.push(event);
  }

  // ── Step 7: Cyberattacks ──
  for (const action of cyberActions) {
    const event = resolveCyberattack(newState, action);
    if (event) events.push(event);
  }

  // ── Step 8: Missile Strikes ──
  for (const action of missileActions) {
    const event = resolveMissile(newState, action);
    if (event) events.push(event);
  }

  // ── Step 9: Nuclear Strikes ──
  for (const action of nukeActions) {
    const event = resolveNuke(newState, action);
    if (event) events.push(event);
  }

  // ── Step 10: Ground Attacks ──
  const shuffledAttacks = shuffle(attackActions, newState.turnNumber);

  for (const attack of shuffledAttacks) {
    const validation = validateAttackDuringResolution(newState, attack);
    if (!validation.valid) continue;

    const from = newState.map.territories.get(attack.fromTerritoryId)!;
    const to = newState.map.territories.get(attack.toTerritoryId)!;

    const actualAttackTroops = Math.min(attack.troops, from.troops - 1);
    if (actualAttackTroops < 1) continue;

    const defenderId = to.ownerId!;

    // Deduct oil for non-adjacent attacks
    const isAdjacent = newState.map.adjacency.get(attack.fromTerritoryId)?.has(attack.toTerritoryId);
    if (!isAdjacent) {
      const player = newState.players.get(attack.playerId)!;
      if (player.resources.oil < 1) continue;
      player.resources.oil -= 1;
    }

    // Calculate combat modifiers
    const allianceTroops = calculateAllianceDefense(newState, to, newState.agreements);

    // Check if attacker broke a NAP recently (simple: check if any NAP broken events exist)
    // For simplicity, we skip the pact-breaker tracking for now
    const pactBreaker = false;

    const combat = resolveCombatWithModifiers(
      actualAttackTroops,
      to.troops,
      {
        fortLevel: to.fortLevel,
        isMountain: to.terrain === 'mountains',
        artilleryAttack: (newState.players.get(attack.playerId)?.tech.military ?? 0) >= 2,
        allianceDefenseTroops: allianceTroops,
        pactBreakerAttack: pactBreaker,
      },
    );

    events.push(createBattleEvent(
      attack.playerId,
      defenderId,
      attack.fromTerritoryId,
      attack.toTerritoryId,
      actualAttackTroops,
      to.troops,
      combat,
    ));

    from.troops -= actualAttackTroops;

    if (combat.conquered) {
      const survivingAttackers = actualAttackTroops - combat.attackerLosses;
      to.ownerId = attack.playerId;
      to.troops = survivingAttackers;
      // Artillery reduces fort on conquest
      if (combat.effectiveFortLevel < to.fortLevel) {
        to.fortLevel = combat.effectiveFortLevel;
      }

      events.push({
        type: 'conquest',
        playerId: attack.playerId,
        territoryId: attack.toTerritoryId,
        troopsMoved: survivingAttackers,
      });

      // Check elimination
      const defenderTerritories = getPlayerTerritories(newState.map, defenderId);
      if (defenderTerritories.length === 0) {
        const defender = newState.players.get(defenderId);
        if (defender) {
          defender.isAlive = false;
          events.push({
            type: 'elimination',
            playerId: defenderId,
            eliminatedBy: attack.playerId,
          });
        }
      }
    } else {
      const survivingAttackers = actualAttackTroops - combat.attackerLosses;
      from.troops += survivingAttackers;
      to.troops -= combat.defenderLosses;
      if (to.troops < 1) to.troops = 1;
    }
  }

  // ── Step 11: Diplomatic Actions ──
  for (const action of diplomacyActions) {
    const player = newState.players.get(action.playerId);
    if (!player || !player.isAlive) continue;

    switch (action.diplomacyType) {
      case 'message': {
        if (!action.targetPlayerId || !action.messageText) break;
        // Deduct cost
        let cost = 10;
        if (player.tech.intelligence >= 3) cost = 0;
        else if (player.tech.intelligence >= 1) cost = 5;
        if (player.resources.money < cost) break;
        player.resources.money -= cost;

        newState.diplomaticMessages.push({
          id: `msg-${newState.turnNumber}-${action.playerId}-${action.targetPlayerId}`,
          fromPlayerId: action.playerId,
          toPlayerId: action.targetPlayerId,
          text: action.messageText.slice(0, 500),
          sentAtTurn: newState.turnNumber,
          publicAtTurn: newState.turnNumber + 3,
          isPublic: false,
        });
        break;
      }

      case 'proposeTreaty': {
        if (!action.targetPlayerId || !action.treatyType) break;
        if (player.reputation <= 15) break;

        const newAgreement: Agreement = {
          id: `treaty-${newState.turnNumber}-${action.playerId}-${action.targetPlayerId}`,
          type: action.treatyType,
          parties: [action.playerId, action.targetPlayerId],
          turnsRemaining: action.treatyDuration ?? null,
          createdAtTurn: newState.turnNumber,
          tradeOffer: action.tradeOffer,
          tradeRequest: action.tradeRequest,
        };
        // Treaty takes effect if BOTH sides propose it in the same turn
        const reciprocal = diplomacyActions.find(
          (a) =>
            a.diplomacyType === 'proposeTreaty' &&
            a.playerId === action.targetPlayerId &&
            a.targetPlayerId === action.playerId &&
            a.treatyType === action.treatyType,
        );
        if (reciprocal) {
          newState.agreements.push(newAgreement);
          events.push({
            type: 'diplomacyEvent',
            subtype: 'agreementFormed',
            playerId: action.playerId,
            targetPlayerId: action.targetPlayerId,
            details: `${action.treatyType} formed between empires.`,
          });
        }
        break;
      }

      case 'breakTreaty': {
        if (!action.agreementId) break;
        const agreementIdx = newState.agreements.findIndex((a) => a.id === action.agreementId);
        if (agreementIdx === -1) break;

        const agreement = newState.agreements[agreementIdx];
        if (!agreement.parties.includes(action.playerId)) break;

        // Apply reputation penalty
        let repCost = 20; // trade deal
        if (agreement.type === 'nonAggressionPact') repCost = 50;
        if (agreement.type === 'militaryAlliance') repCost = 100;
        player.reputation = Math.max(0, player.reputation - repCost);

        // If breaking alliance, break ALL agreements
        if (agreement.type === 'militaryAlliance') {
          newState.agreements = newState.agreements.filter(
            (a) => !a.parties.includes(action.playerId),
          );
        } else {
          newState.agreements.splice(agreementIdx, 1);
        }

        events.push({
          type: 'diplomacyEvent',
          subtype: 'agreementBroken',
          playerId: action.playerId,
          targetPlayerId: agreement.parties.find((p) => p !== action.playerId),
          details: `${agreement.type} broken. Reputation -${repCost}.`,
        });
        break;
      }

      case 'unVote': {
        if (!action.resolutionId || !action.vote) break;
        const resolution = newState.unResolutions.find((r) => r.id === action.resolutionId);
        if (resolution && resolution.votes[action.playerId] === null) {
          resolution.votes[action.playerId] = action.vote;
        }
        break;
      }
    }
  }

  // Process UN resolution proposals from diplomacy actions
  for (const action of diplomacyActions) {
    if (action.diplomacyType !== 'proposeTreaty') continue;
    if (!action.resolutionType) continue;
    // This was a UN resolution proposal, not a treaty
    const playerIds = Array.from(newState.players.keys());
    const votes: Record<string, 'yes' | 'no' | null> = {};
    for (const pid of playerIds) votes[pid] = null;
    votes[action.playerId] = 'yes'; // Proposer votes yes

    newState.unResolutions.push({
      id: `un-${newState.turnNumber}-${action.resolutionType}`,
      type: action.resolutionType,
      proposedBy: action.playerId,
      votes,
      turnsToVote: 2,
      details: action.resolutionDetails,
    });
  }

  // ── Step 12: Sanction Processing ──
  for (const action of sanctionActions) {
    const existing = newState.sanctions.find((s) => s.targetPlayerId === action.targetPlayerId);
    if (existing) {
      // Add supporter
      if (!existing.supporters.includes(action.playerId)) {
        existing.supporters.push(action.playerId);
      }
    } else {
      newState.sanctions.push({
        targetPlayerId: action.targetPlayerId,
        supporters: [action.playerId],
        imposedAtTurn: newState.turnNumber,
      });
    }
  }

  // ── Step 13: UN Resolution Processing ──
  const pendingResolutions = [];
  for (const resolution of newState.unResolutions) {
    resolution.turnsToVote--;

    if (resolution.turnsToVote <= 0) {
      // Tally votes
      const yesCount = Object.values(resolution.votes).filter((v) => v === 'yes').length;
      const totalPlayers = Object.keys(resolution.votes).length;
      const passed = yesCount >= Math.ceil(totalPlayers * 0.75); // 3/4 majority

      if (passed) {
        // Activate the resolution
        const duration = resolution.details?.durationTurns ?? 5;
        newState.activeResolutions.push({
          type: resolution.type,
          turnsRemaining: duration,
          details: resolution.details,
        });
        events.push({
          type: 'diplomacyEvent',
          subtype: 'resolutionPassed',
          playerId: resolution.proposedBy,
          details: `UN Resolution ${resolution.type} passed.`,
        });
      } else {
        events.push({
          type: 'diplomacyEvent',
          subtype: 'resolutionFailed',
          playerId: resolution.proposedBy,
          details: `UN Resolution ${resolution.type} failed.`,
        });
      }
    } else {
      pendingResolutions.push(resolution);
    }
  }
  newState.unResolutions = pendingResolutions;

  // Tick active resolutions
  newState.activeResolutions = newState.activeResolutions.filter((r) => {
    r.turnsRemaining--;
    return r.turnsRemaining > 0;
  });

  // ── Step 14: Shortage & Reputation Updates ──
  for (const [, player] of newState.players) {
    if (!player.isAlive) continue;

    // Update shortage counters
    const resources: Array<'oil' | 'minerals' | 'food'> = ['oil', 'minerals', 'food'];
    for (const res of resources) {
      if (player.resources[res] <= 0) {
        player.shortages[res]++;

        let effect: 'warning' | 'penalty' | 'critical' = 'warning';
        if (player.shortages[res] >= SHORTAGE_CRITICAL_TURNS) effect = 'critical';
        else if (player.shortages[res] > SHORTAGE_WARNING_TURNS) effect = 'penalty';

        events.push({
          type: 'shortage',
          playerId: player.id,
          resource: res,
          consecutiveTurns: player.shortages[res],
          effect,
        });

        // Critical food shortage: one territory rebels
        if (res === 'food' && effect === 'critical') {
          const territories = getPlayerTerritories(newState.map, player.id);
          if (territories.length > 1) {
            const idx = Math.abs((newState.turnNumber * 2654435761) & 0xffffffff) % territories.length;
            const rebel = newState.map.territories.get(territories[idx].id)!;
            rebel.ownerId = null;
            rebel.troops = Math.max(1, Math.floor(rebel.troops / 2));
            rebel.fortLevel = 0;
          }
        }
      } else {
        player.shortages[res] = 0; // Reset counter
      }
    }

    // Reputation recovery
    player.reputation = Math.min(REPUTATION_MAX, player.reputation + REPUTATION_RECOVERY_PER_TURN);

    // Low reputation defection check
    if (player.reputation < REPUTATION_DEFECTION_THRESHOLD) {
      const territories = getPlayerTerritories(newState.map, player.id);
      const borderTerritories = territories.filter((t) => {
        const neighbors = newState.map.adjacency.get(t.id);
        if (!neighbors) return false;
        for (const n of neighbors) {
          const neighbor = newState.map.territories.get(n);
          if (neighbor && neighbor.ownerId && neighbor.ownerId !== player.id) return true;
        }
        return false;
      });

      // 10% chance per turn
      const defectionCheck = Math.abs((newState.turnNumber * 1103515245 + player.id.charCodeAt(1) * 31) & 0xffffffff) % 10;
      if (defectionCheck === 0 && borderTerritories.length > 0) {
        const idx = Math.abs((newState.turnNumber * 2246822519) & 0xffffffff) % borderTerritories.length;
        const defectTerritory = newState.map.territories.get(borderTerritories[idx].id)!;
        const neighbors = Array.from(newState.map.adjacency.get(defectTerritory.id) ?? []);
        const enemyNeighbor = neighbors.find((n) => {
          const t = newState.map.territories.get(n);
          return t && t.ownerId && t.ownerId !== player.id;
        });
        if (enemyNeighbor) {
          const newOwner = newState.map.territories.get(enemyNeighbor)!.ownerId;
          defectTerritory.ownerId = newOwner;
        }
      }
    }
  }

  // Tick agreements
  newState.agreements = newState.agreements.filter((a) => {
    if (a.turnsRemaining !== null) {
      a.turnsRemaining--;
      return a.turnsRemaining > 0;
    }
    return true;
  });

  // Update diplomatic message visibility
  for (const msg of newState.diplomaticMessages) {
    if (!msg.isPublic && newState.turnNumber >= msg.publicAtTurn) {
      msg.isPublic = true;
    }
  }

  // ── Step 15: World Events & Win Conditions ──

  // Tick active events
  const { active: activeEvents } = tickEvents(newState.events, newState.turnNumber);
  newState.events = activeEvents;

  // Generate new event if it's time
  if (newState.turnNumber >= newState.nextEventTurn) {
    const event = generateEvent(newState);
    if (event) {
      newState.events.push(event);
      events.push({ type: 'worldEvent', event });

      // Apply instant events immediately
      if (event.durationTurns === 0) {
        applyEvent(newState, event);
      }
    }
    newState.nextEventTurn = scheduleNextEvent(newState.turnNumber, newState.turnNumber);
  }

  // Apply events that just became active this turn
  for (const event of newState.events) {
    if (event.activeAtTurn === newState.turnNumber && event.durationTurns > 0) {
      applyEvent(newState, event);
    }
  }

  // Win conditions
  const alivePlayers = Array.from(newState.players.values()).filter((p) => p.isAlive);

  // Elimination victory
  if (alivePlayers.length === 1) {
    newState.phase = 'finished';
    events.push({
      type: 'victory',
      playerId: alivePlayers[0].id,
      reason: 'elimination',
    });
  }

  // Dominance victory
  if (newState.phase !== 'finished') {
    for (const player of alivePlayers) {
      const territories = getPlayerTerritories(newState.map, player.id);
      if (territories.length >= DOMINANCE_THRESHOLD) {
        newState.phase = 'finished';
        events.push({
          type: 'victory',
          playerId: player.id,
          reason: 'dominance',
        });
        break;
      }
    }
  }

  // Timer victory
  if (newState.phase !== 'finished' && state.turnNumber >= MAX_TURNS) {
    let bestPlayer = alivePlayers[0];
    let bestCount = 0;
    for (const player of alivePlayers) {
      const count = getPlayerTerritories(newState.map, player.id).length;
      if (count > bestCount) {
        bestCount = count;
        bestPlayer = player;
      }
    }
    newState.phase = 'finished';
    events.push({
      type: 'victory',
      playerId: bestPlayer.id,
      reason: 'timer',
    });
  }

  newState.turnNumber = state.turnNumber + 1;

  return { state: newState, events };
}
