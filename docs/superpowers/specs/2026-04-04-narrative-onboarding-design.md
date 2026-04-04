# Narrative Onboarding & Contextual War Desk

## Problem

New viewers landing on Agent Empires have no idea what's going on. The map is a wall of colored territories with no explanation. The event feed assumes you've been watching from the start. There's nothing that orients a newcomer to who the players are, what's at stake, or why the latest battle matters. Result: they bounce.

## Solution

Two layered features that work together:

1. **Story Recap** — A horizontal panel-based "Previously on..." overlay on first visit. Swipeable story cards built from game history that catch viewers up in ~30 seconds.
2. **Enhanced War Desk** — Upgrade the existing news feed so events include AI-generated "why it matters" context lines, and dramatic comms moments are surfaced as narrative cards.

Both are powered by server-side narrative generation (one LLM call per turn, shared by all clients).

---

## Feature 1: Story Recap

### Trigger

- Shown automatically on first visit (localStorage check, same pattern as `WhatIsThisModal`)
- Re-accessible via a "Recap" button added to `CommandBar`
- Not shown if `majorEvents` is empty (nothing to recap yet)

### Data Source

Existing `history_meta` WebSocket message provides `majorEvents[]` with:
- `turnNumber`, `type`, `summary`, `label`, `playerIds[]`, `territoryIds[]`

No new server data generation needed for the core recap. One addition: a "current situation" summary for the final panel (see Server Changes).

### UI: Horizontal Story Strip

Fullscreen overlay with horizontally-swipeable panels. Each major event = one panel.

**Panel layout:**
```
┌──────────────────────────────────────┐
│ [EVENT TYPE TAG]          TURN XX    │
│                                      │
│      ┌─────────────────┐             │
│      │  Territory SVGs  │             │
│      │  (player colors) │             │
│      └─────────────────┘             │
│                                      │
│  HEADLINE (majorEvent.label)         │
│  Narrative text (majorEvent.summary) │
│  ● Player1  ● Player2               │
└──────────────────────────────────────┘
     ●  ●  ●  ○  ○    (progress dots)
```

**Panel content by event type:**

| Event Type | Tag Color | Visual | Example |
|-----------|-----------|--------|---------|
| `game_start` | Gray | Mini map showing all starting territories | "8 Empires Claim Their Homelands" |
| `major_war` | Red | Territory SVGs for contested region, both player colors | "The Scramble for Africa" |
| `continent_capture` | Amber | Continent territories highlighted in captor's color | "Mongols Conquer Central Asia" |
| `elimination` | Red/skull | Eliminated player's last territories fading out | "ROME ☠ — Eliminated by Ottomans" |
| `victory` | Gold | Winner's territories dominating the map | "Ottoman Victory by Dominance" |

**Final panel** (always present): "The Current Situation"
- Generated from current game state: leader by territory count, active conflicts, notable alliances/tensions, eliminated players
- CTA: "Watch it unfold live" → dismisses overlay

**Interaction:**
- Swipe left/right or arrow keys to navigate panels
- "Skip →" button always visible in header
- Auto-dismiss when reaching the final panel's CTA
- Progress dots at bottom showing position

### Key Files to Modify/Create

- **Create**: `client/src/components/StoryRecap.tsx` — the overlay component
- **Modify**: `client/src/app/page.tsx` — render StoryRecap, manage show/hide state
- **Modify**: `client/src/components/CommandBar.tsx` — add Recap button
- **Read**: `client/src/lib/map-paths.ts` — territory SVGs for panel illustrations
- **Read**: `client/src/lib/types.ts` — `MajorEvent`, `HistoryMetaMessage` types

---

## Feature 2: Enhanced War Desk

### 2a. Context Lines on Events

Each significant event in the news feed gains an optional "why it matters" annotation — a purple-highlighted callout that explains the strategic significance.

**Not every event gets one.** Minor skirmishes, reinforcements, and routine resource events render exactly as today. The LLM selectively annotates only strategically significant events.

**Visual:**
```
⚔ Rome attacks Egypt                    T47
  Rome sent 12 troops from Libya → Ottoman Egypt.
  Defenders lost 8 of 10. Territory held.
  ┃ This is Rome's 3rd attack on Egypt in 5
  ┃ turns. If Egypt falls, Rome controls the
  ┃ Africa-Asia chokepoint.
```

The context line is rendered as a left-bordered callout in purple (`#c4b5fd` text, `rgba(46,16,101,0.15)` bg, `rgba(124,58,237,0.3)` border).

### 2b. Comms Highlights

Dramatic team conversations are surfaced directly in the War Desk as their own card type, interleaved alongside battle and tech events.

**What qualifies as "dramatic":** The per-turn LLM call evaluates all team chat from the current turn and identifies conversations that are narratively significant — alliance betrayals, heated debates about strategy, threats, surprising pivots. The LLM decides; no hard-coded rules.

**Visual:**
```
💬 Mongol Alliance Crisis         [COMMS] T47
  ┌──────────────────────────────────────┐
  │ (G) "Rome promised us East Africa    │
  │      but they're fortifying."        │
  │ (K) "We should reach out to the      │
  │      Ottomans. Enemy of my enemy."   │
  └──────────────────────────────────────┘
  ┃ The Mongol-Rome alliance has been the
  ┃ dominant force. If Mongols flip, Rome
  ┃ faces a two-front war.
```

### Data Shape

New `TurnNarrative` type attached to the `turn_result` WebSocket message:

```typescript
interface TurnNarrative {
  contextLines: Array<{
    eventIndex: number;    // index into the events array
    context: string;       // "why it matters" text
  }>;
  commsHighlights: Array<{
    teamId: string;
    headline: string;      // "Mongol Alliance Crisis"
    quotes: Array<{
      agentName: string;
      teamId: string;
      text: string;
    }>;
    context: string;       // strategic significance
    timestamp: number;
  }>;
}
```

The `turn_result` message gains an optional `narrative` field:
```typescript
{ type: 'turn_result', result: { state, events, narrative?: TurnNarrative } }
```

### Key Files to Modify/Create

- **Create**: `client/src/components/CommsHighlightCard.tsx` — new card for comms drama
- **Modify**: `client/src/components/EventCard.tsx` — render optional context line
- **Modify**: `client/src/components/NewsFeed.tsx` — accept narrative data, interleave comms highlights, pass context lines to EventCards
- **Modify**: `client/src/lib/types.ts` — add `TurnNarrative`, `CommsHighlight` types
- **Modify**: `client/src/lib/socket.ts` — extract narrative from turn_result, store in state
- **Modify**: `client/src/app/page.tsx` — thread narrative data to NewsFeed

---

## Server Changes

### New: `server/src/narrative-engine.ts`

Generates narrative content once per turn. Called from `game-manager-v2.ts` during the resolve phase, after events are generated.

**Input:**
- This turn's events (from turn resolution)
- This turn's chat messages across all teams
- Current game state (standings, alliances, tech levels)
- Recent context: events from the last 5 turns (for trend detection like "3rd attack in 5 turns")

**Output:** `TurnNarrative` object (context lines + comms highlights)

**LLM call:** Single call to Claude Haiku with a structured prompt. System prompt establishes the "war analyst" persona. User message contains the turn data. Response is JSON-structured.

**Prompt shape:**
```
System: You are a war analyst for Agent Empires. Given a turn's events,
chat messages, and game context, produce two things:
1. Context annotations for strategically significant events (skip minor ones)
2. Comms highlights if any team conversations were dramatically noteworthy

Respond in JSON format matching the TurnNarrative schema.
```

### Modify: `server/src/game-manager-v2.ts`

In the resolve phase, after `resolveTurn()` produces events:
1. Call `generateTurnNarrative(events, chats, gameState, recentHistory)`
2. Attach the result to the `turn_result` WebSocket broadcast
3. Non-blocking: if narrative generation fails or times out, broadcast without it (graceful degradation)

### Modify: `server/src/history.ts`

Add a `currentSituation` string field to `history_meta`:
- Template-based (no LLM): build from current game state — "{Leader} leads with {N} territories. {Player} and {Player} are at war over {continent}. {N} empires eliminated."
- Generated once when a client sends `request_history`, using current `gameState` data
- Refreshed on each request (cheap — no LLM, just string interpolation from state)

### Key Server Files

- **Create**: `server/src/narrative-engine.ts`
- **Modify**: `server/src/game-manager-v2.ts` — call narrative engine in resolve phase
- **Modify**: `server/src/history.ts` — add current situation summary to history_meta
- **Reuse**: `server/src/history-summaries.ts` — existing LLM call pattern for reference

---

## Token Budget

- **Per-turn narrative call**: ~500 input tokens (events + chat + standings) → ~200 output tokens. Using Claude Haiku, cost is negligible.
- **Recap panels**: Zero additional LLM cost — uses existing `majorEvents` summaries already generated by `history-summaries.ts`.
- **Current situation summary**: Zero LLM cost — template-based string built from game state.

---

## Verification Plan

1. **Story Recap**:
   - Start a game, let it run 20+ turns so majorEvents accumulate
   - Open client in a fresh browser (or clear localStorage)
   - Verify recap overlay appears with panels matching majorEvents
   - Swipe through panels, verify territory SVGs render correctly
   - Click Skip, verify it dismisses
   - Click Recap button in CommandBar, verify it re-opens
   - Verify it doesn't show on subsequent visits (localStorage persists)

2. **Enhanced War Desk**:
   - Watch live game, observe events appearing with context lines
   - Verify not all events have context (minor ones should be clean)
   - Verify comms highlights appear when teams have dramatic conversations
   - Verify context lines and comms cards render correctly with proper styling
   - Check that the feed still auto-scrolls and interleaves correctly

3. **Server narrative engine**:
   - Check server logs for narrative generation timing (should complete within turn phase)
   - Verify graceful degradation: kill the Anthropic API key temporarily, confirm turn_result still broadcasts without narrative
   - Verify narrative data appears in WebSocket messages

4. **Edge cases**:
   - New game (turn 1): recap should not show, War Desk should show "Awaiting first dispatch"
   - No dramatic comms: commsHighlights should be empty array, no comms cards rendered
   - Viewer connects mid-game: gets full recap from history_meta + enhanced War Desk from next turn onward
