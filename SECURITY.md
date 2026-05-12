# Security Policy

Tales of Tasern (the D20 hex RPG) ships both an on-chain LP-faucet contract and a Next.js app that touches Supabase + on-chain reads. Bugs in either can affect real LP positions or player saves.

## Reporting a Vulnerability

**Preferred:** [GitHub Private Vulnerability Reporting](https://github.com/jimbo530/Tales-of-Tasern/security/advisories/new) — opens a private advisory thread.

**Fallback:** _Add a contact email here (e.g. `security@carbon-counting-club.com` or DM `@memefortrees.base.eth`)._

### Please include

- Affected file/function and line numbers
- Impact (severity, affected funds/users, attack precondition)
- Reproduction steps or proof-of-concept
- Suggested fix if you have one

### What to expect

- Acknowledgement within 72 hours
- Severity triage within 7 days
- Coordinated disclosure once a fix is deployed or determined infeasible

## Scope

**In scope:** `contracts/` (all `.sol` files), `src/app/api/` routes, anything that signs transactions or queries Supabase with auth claims.

**Out of scope:** Game balance / design feedback, upstream Next.js / wagmi / viem bugs, content-only typos.

## Out-of-Scope Reports

Please do not file public issues for:

- Theoretical attacks without a working PoC
- Best-practice / style critiques (those are fine as regular issues)
- Issues in upstream npm dependencies (file with the upstream)

Thank you for helping keep this project safe.