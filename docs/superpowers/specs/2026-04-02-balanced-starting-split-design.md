# Balanced Starting Split

## Context

The current territory assignment algorithm (`assignTerritories()` in `engine/src/game.ts`) uses BFS flood-fill from maximally-spread seeds to divide 146 territories among players. It produces equal territory counts and contiguous blobs, but completely ignores resource production values.

This creates severe starting imbalance: a player seeded near the Middle East earns ~3-4x the resource income of one seeded in Central America or East Africa. With a fixed seed (`SEED = 91`), the same player slots get the same advantage every game. Since this is an AI-vs-AI spectator game, starting position becomes the dominant factor in outcomes, drowning out agent skill.

**Goal:** Make starting resource production roughly equal across all players so that agent strategy — not spawn location — determines who wins.

## Design: Post-Hoc Swap Balancing

Keep the existing BFS flood-fill unchanged. After it produces contiguous blobs, run an iterative balancing pass that swaps border territories between adjacent players to equalize total resource value.

### Territory Value

A territory's value is the sum of its per-turn resource production:

```
value(t) = (t.resources.oil ?? 0) + (t.resources.minerals ?? 0)
         + (t.resources.food ?? 0) + (t.resources.money ?? 0)
```

Examples: Saudi Arabia = 5, Brazil = 9, Belize = 2, Mali = 1.

Total map value is ~376 across 146 territories (avg 2.58). Target per player = totalValue / playerCount.

### Swap Safety Invariant

A territory `t` owned by player `A` can be transferred to adjacent player `B` only if:

1. **`t` is a border territory** — at least one neighbor is owned by `B`
2. **Removing `t` doesn't disconnect `A`** — BFS from any remaining `A` territory (excluding `t`) reaches all other `A` territories
3. **`B` stays contiguous after receiving `t`** — guaranteed by condition 1 (the new territory is adjacent to `B`'s existing blob)

The connectivity check is O(n) where n is the player's territory count (~18). With ~5 border candidates per player and ~10-20 total iterations, total cost is trivial.

### Balancing Algorithm

```
function balanceBySwaps(state, maxIterations = 50, threshold = 4):
  targetValue = totalMapValue / playerCount

  for i in 0..maxIterations:
    values = computePlayerValues(state)  // Map<playerId, number>
    richest = playerWithMaxValue(values)
    poorest = playerWithMinValue(values)

    if values[richest] - values[poorest] <= threshold:
      break  // balanced enough

    // Find best swap: territory from richest's border that can safely
    // transfer to any adjacent player, reducing the max-min gap
    bestSwap = null
    bestImprovement = 0

    for each border territory t of richest:
      if not isRemovalSafe(state, richest, t): continue
      for each neighbor n of t owned by another player:
        recipient = owner(n)
        newRichValue = values[richest] - value(t)
        newRecipientValue = values[recipient] + value(t)
        // Improvement = reduction in max-min gap
        improvement = computeGapReduction(values, richest, recipient, value(t))
        if improvement > bestImprovement:
          bestSwap = { territory: t, from: richest, to: recipient }
          bestImprovement = improvement

    if bestSwap is null: break  // no safe swaps available
    executeSwap(state, bestSwap)
```

If the richest and poorest players don't share a border, the algorithm still converges because:
- Donating a territory from the richest to *any* neighbor reduces the richest player's value
- This may make a different player the new richest, eventually creating adjacency with the poorest
- Each iteration strictly reduces the max player value, guaranteeing convergence

### Threshold

A threshold of 4 resource points means the richest player produces at most 4 more resources/turn than the poorest — roughly 1 high-value territory's difference. This is tight enough to feel fair while allowing the algorithm to converge without excessive border churn.

### Variable Seed

Replace the fixed `SEED = 91` with a seed derived from `Date.now()` at game creation, stored on `GameState` for reproducibility. Each game gets different starting positions, preventing player-slot advantage.

Add an optional `seed` parameter to `assignTerritories()` so tests can pass a fixed seed for determinism.

## Files to Modify

| File | Change |
|------|--------|
| `engine/src/game.ts` | Add `territoryValue()`, `isRemovalSafe()`, `findBestSwap()`, `balanceBySwaps()`. Call `balanceBySwaps()` at end of `assignTerritories()`. Make seed a parameter. |
| `engine/src/types.ts` | Add optional `seed` field to `GameState` for reproducibility. |
| `server/src/game-manager.ts` | Pass `Date.now()` as seed to `assignTerritories()`. |
| `server/src/game-manager-v2.ts` | Same seed change. |
| `engine/src/index.ts` | No change needed (already exports `assignTerritories`). |

## Functions to Add (all in `engine/src/game.ts`)

### `territoryValue(t: Territory): number`
Sum of all resource production fields. ~5 lines.

### `isRemovalSafe(state: GameState, playerId: string, territoryId: string): boolean`
BFS from any remaining player territory excluding the candidate. Returns true if all other player territories are reachable. ~20 lines.

### `balanceBySwaps(state: GameState, seed: number): GameState`
Main balancing loop. Iterates up to 50 times, finds richest/poorest, swaps border territories from richest to a neighbor. Stops when max-min gap <= 4. ~60 lines.

## What Does NOT Change

- Map data (`map.ts`) — territory definitions, resources, adjacency are untouched
- The BFS flood-fill algorithm — it still runs first and produces the same contiguous blobs
- Starting player resources (10 money, 10 food) — unchanged
- Troop counts (3 per territory) — unchanged
- Game rules, combat, diplomacy — all unchanged

## Verification

1. **Unit test:** Run `assignTerritories()` with 8 players, assert max-min resource gap <= 4
2. **Unit test:** Run with 4 players (v2 empires), assert same threshold
3. **Unit test:** Run with multiple seeds, verify contiguity for all players (BFS from any territory reaches all others)
4. **Manual check:** Start a game, inspect the starting state in the UI — resource totals should be visibly close across all players
5. **Regression:** Existing tests in `engine/src/__tests__/validation.test.ts` and `turn.test.ts` should still pass (they call `assignTerritories()` and test game mechanics)
