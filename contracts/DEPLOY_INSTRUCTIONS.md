# PowerUp Contract Deployment

## Step 1: Deploy contracts

Deploy using Remix (remix.ethereum.org) — paste the .sol file, compile with Solidity 0.8.20, deploy.

### Base
- Router: `0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6`
- Deploy `PowerUpBase` with constructor arg: `0x8909Dc15e40173Ff4699343b6eB8132c65e18eC6`

### Polygon
- Router: `0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff` (QuickSwap, same interface)
- Or use: `0x9e5A52f57b3038F1B8EeE45F28B3C1967e22799c` factory's router
- Deploy `PowerUpPolygon` with the router address

## Step 2: Configure stat pairs

Call `setStatPair(statId, tokenA, tokenB, lpPair)` for each stat:

### Base stat pairs:
```
setStatPair(0, "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3", "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3", "0x74af6fd7f98d4ec868156e7d33c6db81fc222e84")
// Stat 0 = ATK: USDGLO + MfT → USDGLO/MfT LP

setStatPair(1, "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3", "0x4f604735c1cf31399c6e711d5962b2b3e0225ad3", "0x74af6fd7f98d4ec868156e7d33c6db81fc222e84")
// Stat 1 = HP: MfT + USDGLO → same LP (MfT side counts as HP)

setStatPair(7, "0x20b048fa035d5763685d695e66adf62c5d9f5055", "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", "0x7af66828a7d1041db8b183f1356797788979eaf8")
// Stat 7 = Multiplier: CHAR + USDC → CHAR/USDC LP
```

### Polygon stat pairs:
```
setStatPair(2, "0xcb2a97776c87433050e0ddf9de0f53ead661dab4", "0x4bf82cf0d6b2afc87367052b793097153c859d38", "0x0cbba81c0094af6911c54ab613fcdf6136d4b498")
// Stat 2 = DEF: TB01 + DDD → TB01/DDD LP

setStatPair(3, "0xcdb4574adb7c6643153a65ee1a953afd5a189cef", "0x4bf82cf0d6b2afc87367052b793097153c859d38", "0x4faf57a632bd809974358a5fff9ae4aec5a51b7d")
// Stat 3 = EATK: JLT-F24 + DDD → JLT/DDD LP

setStatPair(4, "0x8e87497ec9fd80fc102b33837035f76cf17c3020", "0x4bf82cf0d6b2afc87367052b793097153c859d38", "0x4d75b8b5b42f9f3a220334fbc6cebd6fadde880b")
// Stat 4 = FATK: LANTERN + DDD → LANTERN/DDD LP

setStatPair(5, "0xd84415c956f44b2300a2e56c5b898401913e9a29", "0x4bf82cf0d6b2afc87367052b793097153c859d38", "0xa249cc5719da5457b212d9c5f4b1e95c7f597441")
// Stat 5 = MDEF: PR24 + DDD → PR24/DDD LP

setStatPair(6, "0xd838290e877e0188a4a44700463419ed96c16107", "0x4bf82cf0d6b2afc87367052b793097153c859d38", "0xfc983c854683b562c6e0f858a15b32698b32ba45")
// Stat 6 = SP.ATK/MANA: NCT + DDD → NCT/DDD LP
```

## Step 3: Accept payment tokens

Call `setAcceptedToken(token, true)` for each:

### Base accepted tokens:
```
setAcceptedToken("0x4f604735c1cf31399c6e711d5962b2b3e0225ad3", true)  // USDGLO
setAcceptedToken("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", true)  // USDC
setAcceptedToken("0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3", true)  // MfT
setAcceptedToken("0x20b048fa035d5763685d695e66adf62c5d9f5055", true)  // CHAR
setAcceptedToken("0xc1ba76771bbf0dd841347630e57c793f9d5accee", true)  // EGP (Base)
setAcceptedToken("0x06a05043eb2c1691b19c2c13219db9212269ddc5", true)  // BURGERS
```
// ETH accepted natively via powerUpWithETH()

### Polygon accepted tokens:
```
setAcceptedToken("0x4f604735c1cf31399c6e711d5962b2b3e0225ad3", true)  // USDGLO
setAcceptedToken("0x2791bca1f2de4661ed88a30c99a7a9449aa84174", true)  // USDC
setAcceptedToken("0xc2132d05d31c914a87c6611c10748aeb04b58e8f", true)  // USDT
setAcceptedToken("0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6", true)  // WBTC
setAcceptedToken("0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", true)  // WETH
setAcceptedToken("0x4bf82cf0d6b2afc87367052b793097153c859d38", true)  // DDD
setAcceptedToken("0x64f6f111e9fdb753877f17f399b759de97379170", true)  // EGP
setAcceptedToken("0x11f98a36acbd04ca3aa3a149d402affbd5966fe7", true)  // CCC
setAcceptedToken("0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3", true)  // MfT
setAcceptedToken("0xd838290e877e0188a4a44700463419ed96c16107", true)  // NCT
setAcceptedToken("0x2f800db0fdb5223b3c3f354886d907a671414a7f", true)  // BCT
```
// MATIC/POL accepted natively via powerUpWithETH()

## Step 4: Give me the deployed contract addresses

After deploying, tell me the contract addresses and I'll wire them into the Power Up UI so the buttons actually execute transactions.
