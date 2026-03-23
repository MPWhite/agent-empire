import type { GameEvent, SerializedGameState } from "./types";

export interface Headline {
  id: string;
  turnNumber: number;
  severity: "breaking" | "major" | "minor";
  headline: string;
  subtext: string;
  playerIds: string[];
  eventType: string;
}

function playerName(state: SerializedGameState, id: string): string {
  return state.players[id]?.name ?? id;
}

function territoryName(state: SerializedGameState, id: string): string {
  return state.map.territories[id]?.name ?? id;
}

/** Check if a player owns all territories in the continent containing territoryId */
function checkContinentCapture(
  state: SerializedGameState,
  playerId: string,
  territoryId: string
): string | null {
  const territory = state.map.territories[territoryId];
  if (!territory) return null;

  const continent = state.map.continents[territory.continentId];
  if (!continent) return null;

  const ownsAll = continent.territoryIds.every(
    (tid) => state.map.territories[tid]?.ownerId === playerId
  );

  return ownsAll ? continent.name : null;
}

export function generateHeadline(
  event: GameEvent,
  state: SerializedGameState,
  turnNumber: number,
  index: number
): Headline | null {
  const id = `t${turnNumber}-${index}`;

  switch (event.type) {
    case "victory": {
      const name = playerName(state, event.playerId);
      return {
        id,
        turnNumber,
        severity: "breaking",
        headline: `TOTAL DOMINATION: ${name} controls the world`,
        subtext: `All opposition eliminated after ${turnNumber} turns of warfare`,
        playerIds: [event.playerId],
        eventType: event.type,
      };
    }

    case "elimination": {
      const eliminated = playerName(state, event.playerId);
      const by = playerName(state, event.eliminatedBy);
      return {
        id,
        turnNumber,
        severity: "breaking",
        headline: `${eliminated} ELIMINATED by ${by}`,
        subtext: `${eliminated}'s empire collapses — forces wiped from the map`,
        playerIds: [event.playerId, event.eliminatedBy],
        eventType: event.type,
      };
    }

    case "battle": {
      const attacker = playerName(state, event.attackerId);
      const defender = playerName(state, event.defenderId);
      const territory = territoryName(state, event.toTerritoryId);

      if (event.conquered) {
        // Check for continent capture
        const continent = checkContinentCapture(
          state,
          event.attackerId,
          event.toTerritoryId
        );

        if (continent) {
          return {
            id,
            turnNumber,
            severity: "breaking",
            headline: `${attacker} CONQUERS ${continent}`,
            subtext: `${territory} falls — continental bonus secured`,
            playerIds: [event.attackerId, event.defenderId],
            eventType: "continent_capture",
          };
        }

        return {
          id,
          turnNumber,
          severity: "major",
          headline: `${attacker} seizes ${territory} from ${defender}`,
          subtext: `${event.attackerTroops} vs ${event.defenderTroops} — territory captured`,
          playerIds: [event.attackerId, event.defenderId],
          eventType: event.type,
        };
      }

      return {
        id,
        turnNumber,
        severity: "minor",
        headline: `Battle at ${territory}: ${attacker} repelled by ${defender}`,
        subtext: `Losses: ${event.attackerLosses}/${event.defenderLosses}`,
        playerIds: [event.attackerId, event.defenderId],
        eventType: event.type,
      };
    }

    case "reinforcement": {
      const name = playerName(state, event.playerId);
      const territory = territoryName(state, event.territoryId);
      return {
        id,
        turnNumber,
        severity: "minor",
        headline: `${name} fortifies ${territory} (+${event.troops})`,
        subtext: "",
        playerIds: [event.playerId],
        eventType: event.type,
      };
    }

    case "conquest":
      // Skip — redundant with battle conquered=true
      return null;
  }
}

export function generateHeadlines(
  events: GameEvent[],
  state: SerializedGameState,
  turnNumber: number
): Headline[] {
  const headlines: Headline[] = [];
  for (let i = 0; i < events.length; i++) {
    const h = generateHeadline(events[i], state, turnNumber, i);
    if (h) headlines.push(h);
  }
  return headlines;
}
