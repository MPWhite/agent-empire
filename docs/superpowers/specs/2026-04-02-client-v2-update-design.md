# Client V2 Update: Surfacing New Game Mechanics

## Context

The game engine was dramatically overhauled to v2 — adding resources (oil/minerals/food/money), a 3-branch tech tree, diplomacy (treaties, sanctions, UN resolutions), espionage, missiles, nukes with MAD, terrain/forts, and reputation. The server already serializes and sends all this data to clients, but the client ignores it. The client currently only shows territory ownership, troop counts, a basic leaderboard, team chat, and LLM analyst reports.

World events (12 types) are explicitly **out of scope** — they may be removed from the engine.

## Approach

**Hybrid**: Enrich the map with visual layers AND deepen the INTEL tab with full player dossiers. Two-tab layout stays (INTEL + COMMS). Event feed gets real-time styled cards alongside enriched LLM reports.

---

## 1. Client Type Definitions Update

**File:** `client/src/lib/types.ts`

Update to match the server's serialized state. The server already sends all these fields.

### Territory (add fields)
- `terrain: 'plains' | 'mountains' | 'coastal'`
- `resources: Partial<Resources>` — per-turn production
- `fortLevel: number` — 0-3
- `falloutTurns: number` — nuclear fallout countdown

### Player (add fields)
- `resources: Resources` — `{ oil, minerals, food, money }` each 0-50
- `tech: TechLevels` — `{ military, economic, intelligence }` each 0-5
- `reputation: number` — 0-100
- `shortages: ShortageCounters` — `{ oil, minerals, food }` consecutive turns

### SerializedGameState (add fields)
- `agreements: Agreement[]`
- `sanctions: Sanction[]`
- `diplomaticMessages: DiplomaticMessage[]`
- `unResolutions: UNResolution[]`
- `activeResolutions: ActiveResolution[]`
- `maxTurns: number`

### New interfaces needed
- `Resources`, `TechLevels`, `ShortageCounters`
- `Agreement`, `Sanction`, `DiplomaticMessage`, `UNResolution`, `ActiveResolution`
- All match engine types in `engine/src/types.ts`

### GameEvent union (add 8 types)
- `ResearchEvent` — tech level-ups
- `MissileStrikeEvent` — missile impacts
- `NukeEvent` — nuclear strikes + MAD retaliations
- `DiplomacyEvent` — treaties formed/broken, sanctions, resolutions
- `SpyEvent` — intel/sabotage/tech theft/detection
- `ResourceProductionEvent` — resources gained
- `ShortageEvent` — shortage warnings/penalties/critical

(WorldEventOccurrence intentionally excluded — out of scope)

---

## 2. Map Enrichment

**Files:** `client/src/components/Territory.tsx`, `client/src/components/GameMap.tsx`

### Territory visual layers (all shown when zoomed in enough)

Each territory already renders a troop count circle + name. Add:

1. **Terrain icon** — top-right corner of territory label group
   - Mountains: small peak icon (SVG), indicates +50% defense
   - Coastal: wave icon (SVG)
   - Plains: no icon (default)

2. **Resource indicators** — small icons below troop count circle
   - Oil: barrel icon
   - Minerals: pickaxe icon
   - Food: wheat icon
   - Money: coin icon
   - Only show resources the territory actually produces

3. **Fort level** — shield icons next to troop count (1-3 shields)
   - Render as small shield SVG elements
   - Visible on territory label group

4. **Nuclear fallout** — visual overlay on affected territories
   - Territory gets a pulsing yellow/amber border
   - Radiation icon (☢) replaces terrain icon
   - Fallout turn countdown shown below troop count
   - Fill color shifts to sickly yellow/amber tint

### Territory tooltip (hover) enhancement

Currently shows: name, owner, troops, continent.
Add: terrain type, resource production, fort level, fallout status.

### Diplomatic relationship lines

**File:** `client/src/components/GameMap.tsx`

Draw persistent lines between empires with active agreements:
- **Military Alliance**: solid green line between empires' largest territories
- **Trade Deal**: dashed blue line
- **Sanctions**: dotted red line from sanctioner to target

Use the same cross-continent line rendering approach already in GameMap (adjacency lines). Compute "capital" territory per player (most troops) and draw lines between them.

### Map animations (event-driven)

Add a new component `MapAnimations.tsx` that overlays transient SVG animations on the map when events occur:

1. **Nuclear strike**: Expanding shockwave ring centered on target territory. Yellow/amber circle that grows and fades over ~2 seconds. Adjacent territories flash briefly for collateral.

2. **Missile strike**: Brief arcing line from attacker's nearest territory to target. Orange trail that fades. Small burst effect on impact.

3. **Spy operation**: Brief eye icon flash on target player's territory (~1 second). Purple tint.

4. **Diplomacy formation**: Brief connecting line animation between the two empires. Pulses once in the agreement color then settles into the persistent diplomatic line.

Animations are triggered by new events arriving via WebSocket. Queue them and play sequentially if multiple arrive at once. Each animation should be 1-3 seconds.

---

## 3. INTEL Tab — Player Dossier

**File:** `client/src/components/PlayerDetail.tsx`

When a player is selected in the leaderboard, the detail view becomes a full dossier. Add sections below the existing territory chart and intelligence stats:

### Resources section
- 2x2 grid showing each resource with icon, name, current/max (e.g., "32/50")
- Progress bar for each, color-coded by resource type
- Shortage warning inline if consecutive turns > 0:
  - 1-2 turns: dim yellow "warning" text
  - 3-4 turns: amber box, "-30% effectiveness"
  - 5+: red box, "CRITICAL — rebellion imminent" (food) or "LOCKED OUT" (oil/minerals)

### Technology section
- Three progress bars (Military, Economic, Intelligence) each 0-5
- Level number + progress bar filled proportionally
- Special callout at Military 5: "☢ Nuclear capable"
- Color coding: Military=red, Economic=blue, Intelligence=purple

### Reputation section
- Single progress bar 0-100
- Color shifts: green (50+), yellow (15-49), red (<15)
- Label showing treaty eligibility: "Can propose treaties" or "Reputation too low"

### Agreements section
- List of active agreements with icon, type, counterparty, and remaining turns
- Alliance: 🤝 green, Trade: 📦 blue, NAP: 🕊 gray
- Sanctions shown separately with 🚫 red

### Existing sections (keep as-is)
- Territory chart, territory/troop stats, continental control, threat level

---

## 4. INTEL Tab — Leaderboard Enhancement

**File:** `client/src/components/PlayerLeaderboard.tsx`

Add compact tech/capability indicators next to each player in the leaderboard:
- Show highest tech branch + level as a small badge (e.g., "Mil:5 ☢️")
- This gives a quick strategic overview without clicking into each player

---

## 5. Event Feed — Real-time Cards + LLM Reports

### New component: `EventCard.tsx`

Styled cards for each event type with distinct color and icon:

| Event Type | Color | Icon | Border Color |
|-----------|-------|------|-------------|
| `nuke` | Gold/amber | ☢️ | `#fbbf24` |
| `missileStrike` | Orange | 🚀 | `#f97316` |
| `spyEvent` | Purple | 🕵️ | `#a78bfa` |
| `diplomacyEvent` | Green | 🤝 | `#34d399` |
| `research` | Blue | 🔬 | `#60a5fa` |
| `battle` | Gray | ⚔️ | `#71717a` |
| `conquest` | Gray | 🏴 | `#71717a` |
| `shortage` | Yellow | ⚠️ | `#eab308` |
| `elimination` | Red | 💀 | `#ef4444` |
| `victory` | Gold | 🏆 | `#fbbf24` |

Each card shows:
- Icon + event type label (colored, uppercase)
- Turn number (right-aligned, dim)
- Description with player names in their empire colors
- Sub-details for complex events (e.g., MAD retaliations listed under nuke)

### Feed integration

**File:** `client/src/components/NewsFeed.tsx` (or new `EventFeed.tsx`)

When no player is selected, the INTEL tab shows the event feed which contains:
- Real-time event cards (newest on top) — from the WebSocket event stream
- LLM analyst dispatches interspersed at regular intervals (existing report cards)
- Maximum ~200 events retained (oldest dropped)

The existing `report-engine.ts` should be updated to include new event types in the context sent to the LLM for dispatches, so reports reference nukes, diplomacy, tech breakthroughs, etc.

---

## 6. Breaking Ticker Enhancement

**File:** `client/src/components/BreakingTicker.tsx`

Expand the breaking news triggers beyond eliminations/victories/continent captures:
- Nuclear strikes (always breaking)
- MAD retaliation chains
- Military Tech 5 unlocked (nuclear capability)

---

## 7. Tooltip Enhancement

**File:** `client/src/components/GameMap.tsx` (tooltip section)

Currently shows: territory name, owner, troops, continent.
Add:
- Terrain type with defense modifier (e.g., "Mountains +50% def")
- Resources produced (icon list)
- Fort level if > 0 (e.g., "Fort Lv 2 (+40% def)")
- Fallout if active (e.g., "☢ Fallout: 7 turns")

---

## Files to Modify

| File | Changes |
|------|---------|
| `client/src/lib/types.ts` | Add all v2 type definitions |
| `client/src/components/Territory.tsx` | Add terrain, resource, fort, fallout visual layers |
| `client/src/components/GameMap.tsx` | Add diplomatic lines, enhanced tooltip |
| `client/src/components/PlayerDetail.tsx` | Add resources, tech, reputation, agreements sections |
| `client/src/components/PlayerLeaderboard.tsx` | Add tech capability badges |
| `client/src/components/BreakingTicker.tsx` | Expand breaking event triggers |
| `client/src/components/NewsFeed.tsx` | Integrate real-time event cards |
| `client/src/components/ReportCard.tsx` | Keep as-is (LLM dispatches) |
| `client/src/lib/report-engine.ts` | Include new event types in LLM context |
| `client/src/app/page.tsx` | Pass new state to components |

## New Files

| File | Purpose |
|------|---------|
| `client/src/components/MapAnimations.tsx` | SVG animation overlay for nukes, missiles, spy, diplomacy |
| `client/src/components/EventCard.tsx` | Styled event cards for the real-time feed |

---

## Verification

1. **Type safety**: Build the client (`npm run build`) — no TypeScript errors
2. **Visual check**: Run dev server, connect to game server, verify:
   - Map shows terrain icons, resource indicators, forts, fallout on territories
   - Diplomatic lines render between allied/trading empires
   - Clicking a player shows full dossier (resources, tech, reputation, agreements)
   - Leaderboard shows tech badges
   - Event feed shows styled cards for all event types
   - LLM dispatches reference new mechanics
   - Hover tooltip shows terrain, resources, fort, fallout
3. **Animation check**: Trigger events in game and verify map animations play
4. **No regressions**: Existing features (zoom/pan, team chat, proposals, history mode) still work
