# Tales of Tasern

On-chain backed NFT card battle game on Base & Polygon. Every hero is backed by real liquidity — play, fight, grind, and permanently power up your champions.

MfT you SOBs

## What is this?

A tactical RPG where your NFT heroes have stats derived from real on-chain LP tokens locked inside their contracts. The more you play, the more LP flows into your heroes, the stronger they get — forever.

- 3x3 tactical grid combat with D20 rolls, flanking, fire stacking, electric splash
- Story-driven adventure mode with named NPCs and recruitable companions
- LP faucet rewards — play levels, earn real LP deposits to your hero NFTs
- Cloud saves tied to your wallet address
- Repeatable quests with cooldown timers
- World map of Tasern with unlimited expansion potential

## Stack

- Next.js 16 + React 19 + Tailwind 4
- wagmi + viem + OnchainKit (Base + Polygon)
- Supabase (saves, lobbies, marketplace)
- Solidity contracts (PowerUp, LP Faucet)
- Uniswap V2 LP routing

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Contracts

- `contracts/PowerUpAZOS.sol` — ETH to AZOS/MfT LP router
- `contracts/LPFaucet.sol` — Owner-funded LP reward faucet
- `contracts/PowerUpBase.sol` — Generic multi-stat PowerUp (Base)
- `contracts/PowerUpPolygon.sol` — Generic multi-stat PowerUp (Polygon)

## The World of Tasern

The game takes place across the continents of Tasern — Tern, Londa, Blabek, Lanice, and beyond. World 1 begins in Meta, a small settlement on Londa. Roads branch outward to an ever-expanding world that scales to the size of Earth.

## License

MIT

---

*MfT you SOBs*

Built by [memefortrees.base.eth](https://memefortrees.com)
