## HARD STOPS — NEVER VIOLATE THESE

1. **NEVER execute on-chain transactions without explicit user approval.** This includes deploying contracts, minting positions, transferring tokens/NFTs, calling contract functions, or any action that spends gas or moves assets. Write the code, explain what it does, and WAIT for "yes."
2. **NEVER batch irreversible actions.** One transaction at a time. Confirm result. Ask before the next one.
3. **Token flow confirmation is MANDATORY.** Before ANY on-chain action, present a numbered list: 1> this happens, 2> then this, 3> then this. Wait for explicit "yes" or "go." The word "get started" means start EXPLAINING, not start EXECUTING.
4. **"Get started" means begin the first step and check in.** It does NOT mean run the entire pipeline autonomously.
5. **If in doubt, STOP and ASK.** The cost of asking is zero. The cost of a wrong transaction is permanent.

Previous violation: On 2026-04-27, Claude executed 12 irreversible on-chain transactions (4 V3 position mints, 4 NFT transfers to a no-withdraw contract, 4 addPool calls) without user approval, locking ~964K DDD (~$500+) permanently. This happened despite explicit memory rules requiring token flow confirmation. NEVER repeat this.

---

# Tales of Tasern D20 Hex RPG

This is the **d20-stats hex exploration RPG**. It is NOT the simpler card-battle game.

- **Repo**: Tales-of-Tasern
- **Branch**: `main`
- **Stats**: STR / DEX / CON / INT / WIS / CHA (D&D 3.5 style)
- **Chains**: Base (primary) + Polygon
- **Key features**: Hex map exploration, turn-based D&D combat, spells, multi-party, save system
- **Shared data**: `src/lib/contracts.ts` has GAME_NFTS and KNOWN_LP_PAIRS (shared with card game)
- **Game-specific stat mapping**: `STAT_TOKENS` in contracts.ts — maps LP tokens to d20 ability scores
- **Power-ups**: `src/components/PowerUp.tsx` — ETH → LP → NFT stat boosts
- **Deploy contracts**: Always use localhost HTML pages in `public/deploy-*.html` with embedded bytecode (never Remix/CLI)
- **Lore**: Kardov's Gate, Vessel of Namaris, Iron Maw, High Luminar — gritty port city tone
- **Economy**: gp/sp/cp with coin weight, money changers, trade goods

The NFT card game is a **completely separate project** at `C:\Users\bigji\Documents\nft-game`. Never merge code between them.

@AGENTS.md

<!-- VERCEL BEST PRACTICES START -->
## Best practices for developing on Vercel

These defaults are optimized for AI coding agents (and humans) working on apps that deploy to Vercel.

- Treat Vercel Functions as stateless + ephemeral (no durable RAM/FS, no background daemons), use Blob or marketplace integrations for preserving state
- Edge Functions (standalone) are deprecated; prefer Vercel Functions
- Don't start new projects on Vercel KV/Postgres (both discontinued); use Marketplace Redis/Postgres instead
- Store secrets in Vercel Env Variables; not in git or `NEXT_PUBLIC_*`
- Provision Marketplace native integrations with `vercel integration add` (CI/agent-friendly)
- Sync env + project settings with `vercel env pull` / `vercel pull` when you need local/offline parity
- Use `waitUntil` for post-response work; avoid the deprecated Function `context` parameter
- Set Function regions near your primary data source; avoid cross-region DB/service roundtrips
- Tune Fluid Compute knobs (e.g., `maxDuration`, memory/CPU) for long I/O-heavy calls (LLMs, APIs)
- Use Runtime Cache for fast **regional** caching + tag invalidation (don't treat it as global KV)
- Use Cron Jobs for schedules; cron runs in UTC and triggers your production URL via HTTP GET
- Use Vercel Blob for uploads/media; Use Edge Config for small, globally-read config
- If Enable Deployment Protection is enabled, use a bypass secret to directly access them
- Add OpenTelemetry via `@vercel/otel` on Node; don't expect OTEL support on the Edge runtime
- Enable Web Analytics + Speed Insights early
- Use AI Gateway for model routing, set AI_GATEWAY_API_KEY, using a model string (e.g. 'anthropic/claude-sonnet-4.6'), Gateway is already default in AI SDK
  needed. Always curl https://ai-gateway.vercel.sh/v1/models first; never trust model IDs from memory
- For durable agent loops or untrusted code: use Workflow (pause/resume/state) + Sandbox; use Vercel MCP for secure infra access
<!-- VERCEL BEST PRACTICES END -->
