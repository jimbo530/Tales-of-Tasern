# Baseling — LP-Fed Tamagotchi NFT on Base

## Core Loop
- Hatch egg → raise baby → choose when to evolve (burn NFT, mint new form)
- Feed with tokens (WETH = favorite), pet, play, throw ball
- Neglect = death at 72 hours without food
- Poop token drips from interactions (higher tier = bigger multiplier)

## Food = Real Tokens → LP → Vault
Feeding IS depositing. Every feed converts tokens to MfT/TGN LP and stakes in vault.

| Token | Hunger | Happy | Poop | Notes |
|-------|--------|-------|------|-------|
| WETH* | 1.5x   | 1.5x  | 1.5x | Favorite — best at everything |
| BTC   | 1.3x   | 1.0x  | 1.2x | Hearty meal |
| USDC  | 1.0x   | 0.8x  | 1.0x | Plain but filling |
| MfT   | 0.8x   | 1.3x  | 0.8x | Feels like home |
| DEGEN | 0.6x   | 2.0x  | 0.6x | Sugar rush |

- Amount buttons: 0.01, 0.05, 0.1, 0.5, 1.0
- More food = more hunger/happy/poop, LP scales vault
- Poop output also scales with vault size (log bonus)
- Feed tier (lifetime total): SCRAPS → FED → WELL-FED → GORGED → WHALE-FED
- Higher feed tiers unlock rarer evolution branches + game powers
- All feeds create MfT/TGN LP (regardless of input token)
- 0.5% deposit fee on LP creation locked forever (no admin key)

### Feeding Costs Per Stage (USD-denominated)
All meal costs are in USD. Frontend converts to token amounts based on current price. Near-free to start.

| Stage | Min Meal | Giant Meal | Fills Hunger By | Daily Cost (3x) | Giant Daily |
|-------|----------|-----------|-----------------|-----------------|-------------|
| Baby  | $0.01    | $0.02     | ~24hrs          | $0.03           | $0.06       |
| Teen  | $0.05    | $0.10     | ~24hrs          | $0.15           | $0.30       |
| Adult | $0.10    | $0.20     | ~24hrs          | $0.30           | $0.60       |
| Mega  | $0.25    | $0.50     | ~24hrs          | $0.75           | $1.50       |

- Amount buttons: $0.01, $0.05, $0.10, $0.50, $1.00
- Player picks token (WETH, BTC, USDC, etc.) + USD amount
- Frontend converts USD to token amount at current price, then routes to LP
- Feeding a baby costs a literal penny — near free to play

### Giant Threshold: $5.00 USD during egg phase
- $5 total fed into the cracked egg = Giant (2x sprite, 2x hunger forever)
- Costs more than branch unlocks ($1 each) because Giant is permanent 2x hunger tax
- Unlocking a branch = opening a door. Giant = doubling every bill for life.
- Giant + Primordial Core unlock together at $5 — both are serious commitments

### ETERNAL PERFECT Path — 3 Years, Best Odds (3 feeds/day)
The ultimate evolution: ETERNAL tier at every stage × PERFECT care quality.

| Phase         | Days | Feeds/Day | Meal Cost | Total Cost | Giant Total |
|---------------|------|-----------|-----------|-----------|-------------|
| Baby → Teen   | 365  | 3         | $0.01     | $10.95    | $21.90      |
| Teen → Adult  | 365  | 3         | $0.05     | $54.75    | $109.50     |
| Adult → Mega  | 365  | 3         | $0.10     | $109.50   | $219.00     |
| **Total**     | **1,095 (3 yrs)** | | | **$175.20** | **$350.40** |

- Ongoing Mega maintenance: $0.75/day (Giant: $1.50/day)
- This is the rarest possible evolution — 3 years of daily care, no neglect
- ETERNAL PERFECT Mega = one-of-one hand-drawn art when someone earns it
- ETERNAL PERFECT Giant Mega = $350 locked + 3 years dedication = ultimate flex
- All of this goes into LP = permanent liquidity = trees planted / people fed

## Poop Token — Dual Income Model
Two income streams from owning a Baseling:

**Passive income: LP yields** — real yields from vault LP (trading fees, farm rewards)
**Active income: POOP token** — earned through care, mirrors LP yield rates as a fun bonus

### Poop Mechanics
- Baselings digest passively just from being alive (like real Tamagotchi)
- Dead Baselings don't poop
- Active care (feeding, petting, playing) fills poop meter FASTER
- When poop meter hits 100%, Baseling poops on the floor
- Player clicks floor poops to collect POOP tokens
- Poop amount = stage multiplier × vault bonus
- Poop rate mirrors LP yield rates (more LP staked = more poop) but is NOT extracted from actual yields
- Feeding routes trades through DEX → generates volume → increases real LP APY for everyone
- POOP is ERC20 with minter role given to Baseling contract

### Poop Rates (passive digestion per tick, before vault bonus)
| Stage  | Passive Rate | Active Boost (feed) | Stage Multiplier |
|--------|-------------|---------------------|-----------------|
| Baby   | 0.008       | +10-50 per feed     | 2x (20 POOP)   |
| Teen   | 0.015       | +10-50 per feed     | 5x (50 POOP)   |
| Adult  | 0.025       | +10-50 per feed     | 10x (100 POOP) |
| Legend | 0.040       | +10-50 per feed     | 25x (250 POOP) |
| Mega   | 0.060       | +10-50 per feed     | 25x (250 POOP) |

Vault bonus: `1 + log10(1 + totalVaultLP)` — scales passive AND active poop

## LP Vault (per Baseling)
- **Deposit:** 0.5% fee permanently locked in contract (no admin key)
- **Withdraw:** settings page only (not in game UI)
- **Revival cost:** 10% of total vault LP (staked + locked) paid in fresh WETH → locked forever
- Locked LP never comes out. No admin key. No exceptions.

## Evolution System — Player Choice, Not Automatic

### Timing Tiers (how long you wait as baby before choosing to evolve)
Min feeds = just enough to survive the period (1 feed every ~3 days)

| Tier      | Min Days | Min Feeds | Rarity    |
|-----------|----------|-----------|-----------|
| SWIFT     | 14       | 5         | Common    |
| STEADY    | 30       | 10        | Uncommon  |
| PATIENT   | 90       | 30        | Rare      |
| ANCIENT   | 180      | 60        | Legendary |
| ETERNAL   | 365      | 122       | Mythic    |

### Care Quality → Form Quality (what you become)
Care score = avg happiness (35%) + total interactions (35%) + lack of neglect (30%)

| Care Score | Form    | Description                         |
|------------|---------|-------------------------------------|
| 0-14       | TURD    | Neglected, became literal poop      |
| 15-29      | GREMLIN | Feral, barely survived              |
| 30-49      | SCRAPPY | Rough around the edges              |
| 50-69      | HEALTHY | Well cared for                      |
| 70-84      | PRIME   | Excellent care, strong form         |
| 85-100     | PERFECT | Flawless care, peak evolution       |

**Evolution = Tier × Form.** An ETERNAL PERFECT is the ultimate. A SWIFT TURD is valid but embarrassing.

### Egg Care → Hatch Quality
Every tap/pet on the egg before hatching adds to egg care score. Minimum 3 taps to hatch — can always rush, but more care = better trait odds. Rushed eggs still have a small chance at rare traits (nothing is impossible, just unlikely).

| Egg Care   | Taps | Time     | Common | Uncommon | Rare | Legendary |
|------------|------|----------|--------|----------|------|-----------|
| RUSH       | 3    | ~30 sec  | 85%    | 10%      | 4%   | 1%        |
| WARM       | 10   | ~5 min   | 60%    | 25%      | 12%  | 3%        |
| NURTURED   | 25   | ~15 min  | 35%    | 35%      | 22%  | 8%        |
| DEVOTED    | 50   | ~30 min  | 15%    | 30%      | 35%  | 20%       |
| OBSESSED   | 100+ | ~1 hr    | 5%     | 20%      | 40%  | 35%       |

- Egg wobbles harder and glows brighter as care builds (visual feedback)
- Cracks appear at 3 taps (hatch-ready), but player can keep going
- Diminishing returns past OBSESSED (no hard cap)
- Egg care score carries forward — compounds with baby/teen/adult care
- Trait pool: body color, pattern, eyes, shape, accessories

### Cracked Egg Phase — Feed Before Hatch (egg-exclusive traits)
Once the egg cracks (3+ taps), a feed window opens BEFORE hatching. Player can deposit LP into the egg to unlock traits that are **only available during this phase** — once hatched, gone forever.

### Universal Egg Unlocks (total USD across all tokens)
| Total USD | Unlock |
|-----------|--------|
| $0.01+    | Birth Mark — unique pattern visible at all stages |
| $0.10+    | Inner Glow — subtle aura color, persists through evolutions |
| $0.50+    | Cosmic Shell — egg fragment accessory stays on Baseling forever |
| $5.00+    | Primordial Core + GIANT unlocked (2x sprite, 2x hunger forever) |

Giant costs more than branches ($5 vs $1) because 2x hunger is a permanent lifestyle tax.

### Token Branch Unlocks ($1+ of a specific token opens that evolution branch)
Feeding $1+ of a single token into the egg opens exclusive evolution paths for that token's theme. But unlocking a branch just opens the door — you still need the right care score + timing tier to reach the best forms within it.

| Token   | Branch             | Opens At | Best Form Requires |
|---------|--------------------|----------|--------------------|
| WETH    | Arcane Lineage     | $1 WETH  | PERFECT care + PATIENT+ tier |
| BTC     | Fortress Lineage   | $1 BTC   | PERFECT care + STEADY+ tier  |
| TGN     | Mangrove Lineage   | $1 TGN   | PERFECT care + ANCIENT+ tier |
| BURGERS | Hearth Lineage     | $1 BURGERS | PERFECT care + STEADY+ tier |
| AZUSD   | Bedrock Lineage    | $1 AZUSD | PERFECT care + PATIENT+ tier |
| MfT     | Nexus Lineage      | $1 MfT   | PERFECT care + ETERNAL tier  |
| DEGEN   | Chaos Lineage      | $1 DEGEN | Any care (chaotic by nature) |
| USDC    | Digital Lineage    | $1 USDC  | PERFECT care + STEADY+ tier  |

- Multiple branches can be unlocked on the same egg (feed $1 of WETH + $1 of TGN = both open)
- More branches unlocked = more evolution choices later
- A TURD with an unlocked branch gets the worst form of that branch (sad dead tree, cracked fortress, etc.)
- PERFECT care + right timing = the peak form of that branch
- Branch unlocks are permanent and visible — shows what paths are available at evolution time
- Unlocking a branch does NOT guarantee you reach it — care must match

- LP deposited during egg phase goes into vault (same 0.5% fee → locked)
- Stacks with egg care score — OBSESSED care + whale LP = best possible hatch
- Cracked egg shows feed buttons, branch unlock progress
- Player hits HATCH when ready — traits lock permanently at that moment
- Creates "one more deposit" FOMO before committing to hatch

### Giants — Feed the Egg Enough, Get a Big Problem
If total LP deposited during egg phase crosses the Giant threshold, the Baseling hatches at 2x sprite scale. **Warning: Giants eat more at every stage.** Permanent, irreversible.

| Size     | Egg LP   | Sprite Scale | Hunger Decay | Poop Output | Notes |
|----------|----------|-------------|-------------|-------------|-------|
| Normal   | < 2.0    | 1x          | 1x          | 1x          | Standard |
| Giant    | 2.0+     | 2x          | 2x          | 2x          | Eats more, poops more, dies faster if neglected |

- Giants are visually imposing — dominate the room, push smaller Baselings around
- Higher maintenance = higher risk of death = more expensive Reaper runs
- Giant + Reaper = ultimate flex (and ultimate LP sink)
- Giant is permanent — set at hatch, cannot shrink later

### Token Theming — WHAT You Feed Shapes WHO They Become
The dominant token fed during egg phase determines the Baseling's visual theme. Whichever token has the highest LP value fed becomes the "birth flavor." Themes are cosmetic + lore, with minor stat leanings for Chao races.

| Token   | Purpose        | D20 Stats          | Theme              | Visual Style                          | Race Stat Lean     |
|---------|----------------|--------------------|--------------------|---------------------------------------|--------------------|
| WETH    | Magic          | Boon (Vaults of Ether) | Arcane/Mystic  | Blue shimmer, rune marks, mystic flow | +SWIM (magic flow) |
| BTC     | Power/Attack   | Boon (Bitcoin Bastion) | Gold/Fortress  | Orange/gold plating, armored, dense   | +POWER             |
| USDC    | USD stablecoin | —                  | Clean/Digital      | Sharp edges, grid patterns, white     | +STAMINA           |
| MfT     | Central hub    | All 6 (0.5x split) | Nexus/Arcane       | Glowing sigils, hub rings, connected  | +ALL (small)       |
| DEGEN   | Degen culture  | —                  | Chaos/Glitch       | Purple swirls, glitch artifacts       | +SPEED, +LUCK      |
| TGN     | Plants trees   | WIS + CON + CHA    | Mangrove/Living Wood | Bark texture, roots, sprouting leaves | +STAMINA, +LUCK  |
| AZUSD   | Stablecoin     | All 6 (0.5x split) | Bedrock/Foundation | Stone skin, geometric, crystal veins  | +STAMINA           |
| BURGERS | Feeds people   | CON + CON + CON    | Hearth/Feast       | Warm glow, steam wisps, grain pattern | +STAMINA, +POWER   |

**Cross-game consistency:** Same token = same identity everywhere.
- WETH is always magic/arcane — mystic in Baseling, Vaults of Ether boon in D20
- BTC is always power/attack — armored fortress in Baseling, Bitcoin Bastion boon in D20
- BURGERS is always CON/tank — triple CON in D20, Hearth/Feast tank in Baseling
- TGN is always nature/wisdom — Canopy Council in D20, Living Wood in Baseling
- MfT is always the hub — touches all stats in D20, Nexus theme in Baseling

- Theme is permanent — determined at hatch by dominant egg-phase token
- Mixed feeding with no clear dominant = "Prismatic" theme (rainbow, no stat lean, rare)
- Theme affects visual style at ALL evolution stages (baby through legend/reaper)
- Minor race stat lean (not dominant, just a nudge — care patterns still matter most)
- A Burger-themed Giant Reaper is peak absurdity and we love it

### Evolution Stages
- Egg → Baby (min 3 taps, feed LP in cracked phase for exclusive traits)
- Baby → Teen (player chooses when — 2 weeks to 1 year)
- Teen → Adult (same window system, burn teen NFT)
- Adult → Mega/Legend (same window system, burn adult NFT)
- Each burn: LP vault transfers to new NFT, keeps care history + powers

## Reaper Track — 100 Deaths

### Requirements
- Must feed at least 1 time to activate Reaper track
- Must reach desired evolution tier BEFORE starting the death grind
- Each death = 72 hour starvation timer

### Revival Economics (10% compound)
Revival cost = 10% of total vault LP, paid in fresh WETH, locked forever.

Each revival ADDS to the vault total, making the next one cost more:
- Vault 100 → die → pay 10 WETH → vault 110
- Vault 110 → die → pay 11 WETH → vault 121
- Vault 121 → die → pay 12.1 WETH → vault 133.1
- Formula: vault after N deaths = initial × 1.1^N
- Multiplier for 100 deaths: 1.1^100 ≈ 13,780x

### Cheapest Reaper Paths (baby meal = $0.01, feed every ~72hrs, 2 weeks per stage)

Baby Reaper needs only 1 feed ($0.01). Each evolution stage = 14 days ÷ 3 ≈ 5 feeds.

| Target       | Feeds | Feed Cost | Death Phase | Total Time   | Vault USD | Revival Cost (1.1^100) | Total    |
|--------------|-------|-----------|-------------|--------------|-----------|----------------------|----------|
| Reaper Baby  | 1     | $0.01     | 300 days    | ~10 months   | $0.01     | ~$0.14               | ~$0.15   |
| Reaper Teen  | 5     | $0.05     | 300 days    | ~10.5 months | $0.26     | ~$3.59               | ~$3.85   |
| Reaper Adult | 10    | $0.55     | 300 days    | ~11 months   | $1.06     | ~$14.62              | ~$15.68  |
| Reaper Mega  | 15    | $1.30     | 300 days    | ~11.5 months | $2.56     | ~$35.32              | ~$37.88  |

Note: Revival cost = vault × 1.1^100 ≈ 13,780× starting vault. Costs are tiny at minimum feed — the time (10+ months) is the real gate.

### Whale Reaper (buying high-LP Baseling off market)
A well-fed adult with 50 LP in vault:
- 100 deaths: 50 × 13,780 = **$689,000** in revival costs
- All locked forever as LP

### Market Meta for Dead Baselings
- Dead Baselings with death count > 0 have trade value
- Buyer inherits death count (closer to 100 = closer to Reaper)
- Buyer also inherits inflated vault (higher revival costs)
- Example: buy a 60-death Baseling, grind last 40 deaths — but vault is already 1.1^60 = 304x original

### Why Cheapest Path Wins (for cost alone)
- Smart players: hatch egg, neglect baby, feed bare minimum every ~71 hours
- Minimizes LP in vault → minimizes compound revival costs
- Care score = garbage → TURD/GREMLIN form quality
- BUT: Reaper form quality DOES matter — ultra-tier custom skins/abilities locked behind care score
- A PERFECT Reaper unlocks customs a TURD Reaper never will
- Cheapest path = cheapest Reaper, not the best Reaper
- True endgame flex: high-care Reaper with maxed form quality + 100 deaths + massive locked LP

## Chao Races — Competitive Mini-Games (Sonic Adventure 2 style)

### Stats (derived from care patterns)
Each Baseling builds hidden race stats based on HOW you raise it:

| Stat    | Derived From                                   |
|---------|------------------------------------------------|
| SPEED   | Total feeds (more food = more energy)           |
| STAMINA | Consistency — feeding on time, no neglect gaps  |
| POWER   | Total LP in vault (well-funded = strong)        |
| LUCK    | Variety — feeding different tokens, all actions |
| SWIM    | WETH feeds specifically (favorite food bonus)   |

### Race Types
- **Sprint** — pure SPEED check, short race
- **Marathon** — STAMINA dominant, SPEED secondary
- **Obstacle** — POWER + SPEED, crashes if low STAMINA
- **Treasure Hunt** — LUCK dominant, random item spawns
- **River Race** — SWIM + STAMINA, water-themed course

### How It Works
- Enter your Baseling in a race (costs a small POOP entry fee)
- Race plays out as a simple auto-battler animation (like Chao races)
- Baseling's hidden stats + small RNG determine placement
- Winner gets POOP prize pool from all entries
- Race results affect happiness (+happy for good placement, still fun if you lose)
- Higher evolution tier = stat cap increases (Legend can max out, Baby can't)
- Care form quality adds flat stat bonuses (PERFECT gets +10 all, TURD gets +0)

### Racing Meta
- Speed-focused: feed constantly, lots of food → fast but might lack stamina
- Balanced: consistent daily care, variety of tokens → good at everything
- Tank: whale LP vault, power feeds → slow but smashes obstacles
- Lucky: feed every token type, use every action equally → treasure hunt specialist
- WETH mains: all-in on favorite food → swim race dominance

### Race Rewards
- Entry fee: 10 POOP per race
- Prize pool: split among top 3 (60/30/10)
- Daily featured race type rotates
- Seasonal tournaments with bigger pools
- Racing counts as interaction (resets death timer, small poop gain)

## Key Economic Properties
1. Every death permanently locks LP — protocol liquidity only goes up
2. Compound 10% means costs escalate exponentially — no cheap shortcuts for whales
3. 72-hour death timer = 300 days minimum for 100 deaths — can't speed run
4. Minimum feed requirement prevents zero-interaction death farming
5. Dead Baselings have market value (death count + locked LP = closer to Reaper)
6. All locked LP is keyless — no admin, no rug, permanent liquidity
