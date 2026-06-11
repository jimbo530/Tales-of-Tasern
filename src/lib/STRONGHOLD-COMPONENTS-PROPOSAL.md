# Stronghold Components — World of War Integration Proposal

**Status:** data file (`strongholdComponents.ts`) is live and self-contained; the WoW engine does not consume it yet. This doc is the plan to wire it in.

## What exists today

World of War (`worldOfWar.ts`) models a castle as a single object with a **level 1–5** (Outpost → Capital). Each level grants flat `defense`, `maxHp`, `maxGarrison`, and `productionBonus` from `CASTLE_LEVELS`. There is no way to customize a hold — every level-3 Fortress is identical to every other.

## What this adds

`strongholdComponents.ts` introduces **modular add-ons** a player builds onto a castle: walls, towers, a gatehouse, a moat, barracks, a forge, a mana spire, a cistern, and so on (21 components across 5 categories: defense, military, economy, arcane, utility). Each has a `Treasury` build cost, a build time in turns, a minimum castle level, and typed effects (`defenseBonus`, `hpBonus`, `garrisonBonus`, `productionBonus`, `upkeepReduction`, plus `tags` for special behaviors).

This turns a castle from a number into a **build order** — two players with level-3 Fortresses can field very different holds (one a hedgehog of walls and towers, the other an economic engine of mills and markets).

Source: rethemed from Stronghold Builder's Guidebook concepts. Costs are deliberately re-expressed in WoW resources (gold/food/iron/wood/mana), **not** the book's raw gp, so they balance against `CASTLE_LEVELS` and `UNIT_DEFS` instead of breaking the resource economy.

## Integration steps (when WoW is ready to consume it)

1. **Add a `components` field to `Castle`:**
   ```ts
   // in worldOfWar.ts, type Castle
   components: string[];   // ids of built StrongholdComponents
   ```
   Initialize to `[]` in `createCastle` / `startCastle`.

2. **Add `buildComponent(kingdom, castleId, componentId)`** mirroring `recruitArmy`/`upgradeCastle`:
   - look up the component via `getComponent(id)`;
   - reject if `castle.level < component.minCastleLevel`, if already built, or if `castle.buildProgress > 0`;
   - check `canAfford(kingdom.treasury, component.buildCost)`, deduct it;
   - set a per-component build timer (reuse `buildProgress`, or add `componentProgress: Record<string, number>` so a castle can queue several);
   - on completion, push the id into `castle.components`.

3. **Fold component effects into the castle's derived stats.** Add a helper:
   ```ts
   export function effectiveCastleStats(castle: Castle): {
     defense: number; maxHp: number; maxGarrison: number; production: Treasury;
   }
   ```
   that starts from `CASTLE_LEVELS[castle.level - 1]` and adds each built component's
   `defenseBonus` / `hpBonus` / `garrisonBonus` / `productionBonus`. Call this anywhere
   the engine currently reads `castle.defense`, `castle.maxHp`, `castle.maxGarrison`, or
   per-turn production (siege resolution, the turn tick, the UI).

4. **Wire the `tags` into combat/economy** (incremental — each is independent):
   - `choke_point` (gatehouse): attacker must reduce the gatehouse HP before engaging the garrison.
   - `anti_siege` (moat): negate a % of `siege_engines` strength in the siege math.
   - `cover` / `enfilade` (battlements / corner tower): reduce defender losses / add ranged defense.
   - `siege_rations` + `siege_water` (granary / cistern): increase the number of `siegeTurns` a castle survives before morale collapse.
   - `faster_recruit`, `build_siege`, `mount_cavalry`: modify recruitment options/cost/level at this castle.
   - `counter_magic` (warding sanctum): reduce enemy `mages` effectiveness in a siege.
   - `protect_treasury` (vault): on castle capture, a share of `kingdom.treasury` is preserved.
   - `reinforce_signal` (beacon): shorten reinforcement arrival time.
   - `trade_hub` (market quarter): scale gold income with connected caravan routes (ties into the economy design's trade-route layer).

5. **AI build priorities:** give AI kingdoms a simple weighting (defense components when threatened, economy when safe) in the existing AI turn logic so they use components too.

## Why staged, not merged now

The mission's ground rules cap this workstream at data + proposal for systems WoW can't yet consume. Steps 1–3 are a focused, low-risk follow-up (one new field, one build function, one stats helper); step 4 can land tag-by-tag. Nothing in `strongholdComponents.ts` touches game state today, so it ships safely as a catalog and waits for the engine work above.

## Marquee names for the owner's flavor pass

The component names are workmanlike Tasern flavor. Candidates the owner may want to punch up: **Mana Spire**, **Warding Sanctum**, **Tide Mill**, **Signal Beacon** — these are the evocative, world-defining structures where his lore voice would add the most.
