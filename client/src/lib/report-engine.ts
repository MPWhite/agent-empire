import type { GameEvent, SerializedGameState } from "./types";

export interface ReportTrigger {
  mode: "dispatch" | "breaking";
  events: GameEvent[];
  state: SerializedGameState;
  turnRange: [number, number];
}

export class ReportEngine {
  private eventBuffer: GameEvent[] = [];
  private lastDispatchTurn = 0;
  private dispatchInterval: number;
  private generating = false;

  constructor(dispatchInterval = 10) {
    this.dispatchInterval = dispatchInterval;
  }

  /** Returns a trigger if a report should be generated, null otherwise */
  addTurnEvents(
    events: GameEvent[],
    state: SerializedGameState,
    turnNumber: number
  ): ReportTrigger | null {
    this.eventBuffer.push(...events);

    // Don't trigger if we're already generating
    if (this.generating) return null;

    // Check for breaking events
    const breakingEvents = events.filter(
      (e) =>
        e.type === "elimination" ||
        e.type === "victory" ||
        (e.type === "battle" && e.conquered && this.isContinentCapture(e, state))
    );

    if (breakingEvents.length > 0) {
      return {
        mode: "breaking",
        events: breakingEvents,
        state,
        turnRange: [turnNumber, turnNumber],
      };
    }

    // Check if dispatch is due
    if (turnNumber - this.lastDispatchTurn >= this.dispatchInterval) {
      const trigger: ReportTrigger = {
        mode: "dispatch",
        events: [...this.eventBuffer],
        state,
        turnRange: [this.lastDispatchTurn + 1, turnNumber],
      };
      this.eventBuffer = [];
      this.lastDispatchTurn = turnNumber;
      return trigger;
    }

    return null;
  }

  markGenerating(value: boolean): void {
    this.generating = value;
  }

  reset(): void {
    this.eventBuffer = [];
    this.lastDispatchTurn = 0;
    this.generating = false;
  }

  private isContinentCapture(
    event: GameEvent,
    state: SerializedGameState
  ): boolean {
    if (event.type !== "battle" || !event.conquered) return false;

    const territory = state.map.territories[event.toTerritoryId];
    if (!territory) return false;

    const continent = state.map.continents[territory.continentId];
    if (!continent) return false;

    return continent.territoryIds.every(
      (tid) => state.map.territories[tid]?.ownerId === event.attackerId
    );
  }
}
