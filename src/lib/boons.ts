// ─── Impact Boon System ──────────────────────────────────────────────────────
// Boons are special abilities unlocked by holding impact or traditional tokens.
// Count-based boons use raw token amounts; dollar-based boons use USD value.

export type Boon = {
  name: string;
  effect: string;
  tier: number;
  category: string;
};

export type BoonCategory = {
  name: string;
  description: string;
  boons: { threshold: number; name: string; effect: string }[];
};

// ─── Count-Based Boon Tokens (addresses, lowercase) ─────────────────────────

// Carbon credit quality weights (effective lbs per token, 1 metric tonne = 2,204 lbs)
export const CARBON_WEIGHTS: Record<string, number> = {
  "0x20b048fa035d5763685d695e66adf62c5d9f5055": 2204,   // CHAR (Base) — 1/1 tonne
  "0xef6ab48ef8dfe984fab0d5c4cd6aff2e54dfda14": 1102,   // CRISP-M — 1/2 tonne
  "0x11f98a36acbd04ca3aa3a149d402affbd5966fe7": 1,       // CCC — 1 lb
  "0xd838290e877e0188a4a44700463419ed96c16107": 220,     // NCT — 1/10 tonne
  "0x2f800db0fdb5223b3c3f354886d907a671414a7f": 110,     // BCT — 1/20 tonne
};

// Tree tokens (1 token = 1 tree)
export const TREE_TOKENS = new Set([
  "0xace15da4edcec83c98b1fc196fc1dc44c5c429ca", // JCGWR
  "0x146642d83879257ac9ed35074b1c3714b7e8f452", // AU24T
]);

// Storm tokens (1 token = 1 MWh)
export const STORM_TOKENS = new Set([
  "0xcdb4574adb7c6643153a65ee1a953afd5a189cef", // JLT-F24
  "0x0b31cc088cd2cd54e2dd161eb5de7b5a3e626c9e", // JLT-B23
]);

// Lightbearer tokens (1 token = 1 lantern)
export const LIGHT_TOKENS = new Set([
  "0x8e87497ec9fd80fc102b33837035f76cf17c3020", // LANTERN
]);

// Tidekeeper tokens (cleanup)
export const TIDE_TOKENS = new Set([
  "0xcb2a97776c87433050e0ddf9de0f53ead661dab4", // TB01
  "0x861f57e96678c6cb586f07dd8d3b0c34ce19dd82", // LTK
]);

// Herald tokens (1 token = 1 kid helped)
export const HERALD_TOKENS = new Set([
  "0xd84415c956f44b2300a2e56c5b898401913e9a29", // PR24
  "0x72e4327f592e9cb09d5730a55d1d68de144af53c", // PR25
]);

// ─── Dollar-Value Boon Tokens ────────────────────────────────────────────────

// Traditional crypto (boons only, no base stats)
export const WETH_TOKENS = new Set([
  "0x4200000000000000000000000000000000000006", // WETH (Base)
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // WETH (Polygon)
]);

export const WBTC_TOKENS = new Set([
  "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6", // WBTC (Polygon)
]);

export const WPOL_TOKENS = new Set([
  "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", // WPOL
]);

// MfT hub token (0.5x all stats + Noble Birth boon)
export const MFT_TOKENS = new Set([
  "0x8fb87d13b40b1a67b22ed1a17e2835fe7e3a9ba3", // MfT (Base)
]);

// Impact stat tokens that ALSO get dollar-value boons (on top of 1.5x base stats)
export const BURGERS_TOKENS = new Set([
  "0x06a05043eb2c1691b19c2c13219db9212269ddc5", // BURGERS (Base)
]);

export const TGN_TOKENS = new Set([
  "0xd75dfa972c6136f1c594fec1945302f885e1ab29", // TGN (Base)
]);

export const REGEN_TOKENS = new Set([
  "0xdfffe0c33b4011c4218acd61e68a62a32eaf9a8b", // REGEN (Polygon)
]);

export const GRANT_WIZARD_TOKENS = new Set([
  "0xdb7a2607b71134d0b09c27ca2d77b495e4dbeedb", // Grant Wizard (Polygon)
]);

// ─── All boon-only token addresses (no base stats) ──────────────────────────
export const BOON_ONLY_TOKENS = new Set([
  ...Object.keys(CARBON_WEIGHTS),
  ...TREE_TOKENS, ...STORM_TOKENS, ...LIGHT_TOKENS,
  ...TIDE_TOKENS, ...HERALD_TOKENS,
  ...WETH_TOKENS, ...WBTC_TOKENS, ...WPOL_TOKENS,
]);

// ─── Count-Based Boon Definitions ───────────────────────────────────────────

// Thresholds in effective units (lbs for carbon, count for others)
export const COUNT_BOONS: Record<string, BoonCategory> = {
  carbon: {
    name: "Carbon Guardians",
    description: "Purification through offsetting pollution",
    boons: [
      { threshold: 220,   name: "Blessing of Pure Air",   effect: "Immune to poison condition" },
      { threshold: 1102,  name: "Boon of Restoration",    effect: "Cast Lesser Restoration 1/long rest" },
      { threshold: 2204,  name: "Boon of Perfect Health", effect: "Immune to disease and poison damage" },
      { threshold: 4408,  name: "Boon of the Purifier",   effect: "Aura 10 ft: allies advantage on CON saves vs poison/disease" },
    ],
  },
  trees: {
    name: "Wardens of the Grove",
    description: "Strength drawn from planted forests",
    boons: [
      { threshold: 100,   name: "Blessing of Barkskin",      effect: "+1 NA (natural armor)" },
      { threshold: 500,   name: "Boon of Entanglement",      effect: "Cast Entangle 1/long rest" },
      { threshold: 2000,  name: "Boon of the Treant",        effect: "+2 NA (natural armor), resistance to bludgeoning" },
      { threshold: 10000, name: "Boon of the Living Forest", effect: "Cast Wall of Thorns 1/long rest" },
    ],
  },
  storm: {
    name: "Stormborn",
    description: "Channeling renewable energy into lightning",
    boons: [
      { threshold: 1,  name: "Blessing of Static",      effect: "+1d4 lightning damage on melee hits" },
      { threshold: 5,  name: "Boon of the Stormborn",   effect: "Resistance to lightning and thunder damage" },
      { threshold: 10, name: "Boon of Thunder",          effect: "Cast Call Lightning 1/long rest" },
      { threshold: 20, name: "Boon of the Tempest",      effect: "Immune to lightning; when hit in melee, attacker takes 2d6 lightning" },
    ],
  },
  light: {
    name: "Lightbearers",
    description: "Solar lanterns igniting inner flame",
    boons: [
      { threshold: 0.25, name: "Blessing of the Flame", effect: "+1d4 fire damage on melee hits" },
      { threshold: 1.25, name: "Boon of the Fire Soul", effect: "Resistance to fire, darkvision 60 ft" },
      { threshold: 2.5,  name: "Boon of Radiance",      effect: "Cast Daylight at will" },
      { threshold: 6.25, name: "Boon of the Sun",        effect: "Immune to fire; cast Fireball 1/short rest" },
    ],
  },
  tide: {
    name: "Tidekeepers",
    description: "Cleaning shores and streets empowers defense",
    boons: [
      { threshold: 10,   name: "Blessing of the Shield",  effect: "+1 AC" },
      { threshold: 100,  name: "Boon of Resilience",      effect: "Resistance to one damage type (chosen on long rest)" },
      { threshold: 500,  name: "Boon of the Unfettered",  effect: "Cannot be grappled or restrained" },
      { threshold: 2000, name: "Boon of Invincibility",   effect: "Resistance to all damage for 1 round, 1/short rest" },
    ],
  },
  herald: {
    name: "Heralds of Hope",
    description: "Each child helped grants swiftness and protection",
    boons: [
      { threshold: 1,  name: "Blessing of Swiftness",      effect: "+5 ft move speed" },
      { threshold: 5,  name: "Boon of Dimensional Step",   effect: "Cast Misty Step 1/short rest" },
      { threshold: 10, name: "Boon of Speed",              effect: "+15 ft move speed, opportunity attacks have disadvantage against you" },
      { threshold: 25, name: "Boon of the Guardian",        effect: "Reaction: when ally within 30 ft is hit, teleport adjacent and take hit instead" },
    ],
  },
};

// ─── Dollar-Value Boon Definitions ($10/$50/$100/$200) ──────────────────────

export const DOLLAR_BOONS: Record<string, BoonCategory> = {
  burgers: {
    name: "Feast of the Burger",
    description: "LP fees fund food donations",
    boons: [
      { threshold: 10,  name: "Blessing of Sustenance", effect: "Half rations, +1 HP per rest" },
      { threshold: 50,  name: "Boon of Wound Closure",  effect: "Auto-stabilize at 0 HP, double CON mod healing on rest" },
      { threshold: 100, name: "Boon of Recovery",        effect: "Bonus action regain half max HP, 1/long rest" },
      { threshold: 200, name: "Boon of the Feast",       effect: "Short rest: allies 30 ft get +1 HP per your CON mod" },
    ],
  },
  tgn: {
    name: "Canopy Council",
    description: "Tree planting DAO governance",
    boons: [
      { threshold: 10,  name: "Blessing of the Canopy",  effect: "Advantage on Survival checks in forests" },
      { threshold: 50,  name: "Boon of Speak with Plants", effect: "Cast Speak with Plants 1/long rest" },
      { threshold: 100, name: "Boon of the Dryad",        effect: "Cast Tree Stride 1/long rest" },
      { threshold: 200, name: "Boon of the World Tree",   effect: "Cast Transport via Plants 1/long rest" },
    ],
  },
  regen: {
    name: "Rebuilder's Resolve",
    description: "ReFi infrastructure",
    boons: [
      { threshold: 10,  name: "Blessing of Regeneration", effect: "Regain 1 HP at start of each turn if above 0 HP" },
      { threshold: 50,  name: "Boon of Mending",          effect: "Cast Greater Restoration 1/long rest" },
      { threshold: 100, name: "Boon of Renewal",           effect: "Resistance to necrotic damage, immune to aging effects" },
      { threshold: 200, name: "Boon of the Phoenix",       effect: "On death, revive at half HP, 1/long rest" },
    ],
  },
  grantWizard: {
    name: "The Grantmaker",
    description: "Public goods funding",
    boons: [
      { threshold: 10,  name: "Blessing of Insight",       effect: "Proficiency in one extra skill" },
      { threshold: 50,  name: "Boon of Luck",              effect: "Reroll one d20, 1/short rest" },
      { threshold: 100, name: "Boon of Fate",              effect: "Add or subtract 1d10 from any creature's roll, 1/short rest" },
      { threshold: 200, name: "Boon of Magic Resistance",  effect: "Advantage on all saving throws against spells" },
    ],
  },
  weth: {
    name: "Vaults of Ether",
    description: "Arcane wealth from smart contracts",
    boons: [
      { threshold: 10,  name: "Blessing of Arcana",     effect: "Proficiency in Arcana checks" },
      { threshold: 50,  name: "Boon of Spell Recall",   effect: "Recover one spell slot (up to 3rd level), 1/long rest" },
      { threshold: 100, name: "Boon of Counterspell",   effect: "Cast Counterspell 1/long rest" },
      { threshold: 200, name: "Boon of High Magic",     effect: "One additional spell slot (up to 5th level)" },
    ],
  },
  wbtc: {
    name: "The Bitcoin Bastion",
    description: "Immutable store of value",
    boons: [
      { threshold: 10,  name: "Blessing of Fortitude",    effect: "+5 max HP" },
      { threshold: 50,  name: "Boon of Iron Skin",        effect: "+1 AC" },
      { threshold: 100, name: "Boon of Fortitude",         effect: "+20 max HP" },
      { threshold: 200, name: "Boon of the Unbreakable",  effect: "Drop to 1 HP instead of 0, 1/long rest" },
    ],
  },
  wpol: {
    name: "Threads of Polygon",
    description: "The fast network",
    boons: [
      { threshold: 10,  name: "Blessing of Haste",     effect: "+5 ft move speed" },
      { threshold: 50,  name: "Boon of Initiative",    effect: "+2 to initiative rolls" },
      { threshold: 100, name: "Boon of Evasion",       effect: "DEX saves: half damage becomes none, fail becomes half" },
      { threshold: 200, name: "Boon of Action Surge",  effect: "One additional action, 1/long rest" },
    ],
  },
  mft: {
    name: "Noble Birth",
    description: "A distant noble title — coin arrives by courier from far-off estates",
    boons: [
      { threshold: 10,    name: "Distant Heir",              effect: "5cp per day from a forgotten inheritance" },
      { threshold: 25,    name: "Minor Landholder",          effect: "1sp per day from tenant farmers abroad" },
      { threshold: 50,    name: "Letter of Credit",          effect: "3sp per day; merchants recognize your family seal" },
      { threshold: 100,   name: "Titled Gentry",             effect: "1gp per day; couriers deliver stipends from distant holdings" },
      { threshold: 250,   name: "Baron of the Reaches",      effect: "3gp per day; your barony sends quarterly tribute" },
      { threshold: 500,   name: "Viscount Abroad",           effect: "5gp per day; your steward manages estates you've never seen" },
      { threshold: 1000,  name: "Count of Distant Shores",   effect: "10gp per day; trade caravans carry your colors" },
      { threshold: 2500,  name: "Marquess of the Frontier",  effect: "25gp per day; border lords swear fealty in your name" },
      { threshold: 5000,  name: "Duke in Absentia",          effect: "50gp per day; a duchy prospers under your appointed regent" },
      { threshold: 10000, name: "Sovereign Claimant",         effect: "1000gp per day; a throne awaits across the sea — enough to host a small army" },
    ],
  },
};

// ─── Boon Computation ────────────────────────────────────────────────────────

type TokenAmount = { symbol: string; amount: number; addr?: string };

/** Resolve the highest unlocked tier (0-based) or -1 if none */
function highestTier(value: number, category: BoonCategory): number {
  let tier = -1;
  for (let i = 0; i < category.boons.length; i++) {
    if (value >= category.boons[i].threshold) tier = i;
  }
  return tier;
}

/**
 * Compute all active boons from token holdings.
 */
export function computeBoons(
  tokenAmounts: TokenAmount[],
  tokenUsdPrices: Record<string, number>,
): Boon[] {
  const boons: Boon[] = [];

  // Accumulators for count-based boons
  let carbonLbs = 0;
  let trees = 0;
  let stormMwh = 0;
  let lanterns = 0;
  let tidePieces = 0;
  let kidsHelped = 0;

  // Accumulators for dollar-value boons
  let mftUsd = 0;
  let burgersUsd = 0;
  let tgnUsd = 0;
  let regenUsd = 0;
  let grantWizardUsd = 0;
  let wethUsd = 0;
  let wbtcUsd = 0;
  let wpolUsd = 0;

  for (const ta of tokenAmounts) {
    const addr = ta.addr?.toLowerCase();
    if (!addr || ta.amount === 0) continue;
    const usdPrice = tokenUsdPrices[addr] ?? 0;
    const usdValue = ta.amount * usdPrice;

    // Count-based: carbon
    if (addr in CARBON_WEIGHTS) {
      carbonLbs += ta.amount * CARBON_WEIGHTS[addr];
    }
    // Count-based: trees
    else if (TREE_TOKENS.has(addr)) { trees += ta.amount; }
    // Count-based: storm
    else if (STORM_TOKENS.has(addr)) { stormMwh += ta.amount; }
    // Count-based: light
    else if (LIGHT_TOKENS.has(addr)) { lanterns += ta.amount; }
    // Count-based: tide
    else if (TIDE_TOKENS.has(addr)) { tidePieces += ta.amount; }
    // Count-based: herald
    else if (HERALD_TOKENS.has(addr)) { kidsHelped += ta.amount; }
    // Dollar-based: MfT hub token
    else if (MFT_TOKENS.has(addr)) { mftUsd += usdValue; }
    // Dollar-based: impact stat tokens
    else if (BURGERS_TOKENS.has(addr)) { burgersUsd += usdValue; }
    else if (TGN_TOKENS.has(addr)) { tgnUsd += usdValue; }
    else if (REGEN_TOKENS.has(addr)) { regenUsd += usdValue; }
    else if (GRANT_WIZARD_TOKENS.has(addr)) { grantWizardUsd += usdValue; }
    // Dollar-based: tradfi
    else if (WETH_TOKENS.has(addr)) { wethUsd += usdValue; }
    else if (WBTC_TOKENS.has(addr)) { wbtcUsd += usdValue; }
    else if (WPOL_TOKENS.has(addr)) { wpolUsd += usdValue; }
  }

  // Resolve count-based boons (convert carbon lbs to effective tonnes for threshold comparison)
  const countChecks: [number, string, BoonCategory][] = [
    [carbonLbs, "carbon", COUNT_BOONS.carbon],
    [trees, "trees", COUNT_BOONS.trees],
    [stormMwh, "storm", COUNT_BOONS.storm],
    [lanterns, "light", COUNT_BOONS.light],
    [tidePieces, "tide", COUNT_BOONS.tide],
    [kidsHelped, "herald", COUNT_BOONS.herald],
  ];

  for (const [value, cat, def] of countChecks) {
    const tier = highestTier(value, def);
    if (tier >= 0) {
      // Add all unlocked tiers (cumulative)
      for (let i = 0; i <= tier; i++) {
        boons.push({ name: def.boons[i].name, effect: def.boons[i].effect, tier: i + 1, category: cat });
      }
    }
  }

  // Resolve dollar-based boons
  const dollarChecks: [number, string, BoonCategory][] = [
    [mftUsd, "mft", DOLLAR_BOONS.mft],
    [burgersUsd, "burgers", DOLLAR_BOONS.burgers],
    [tgnUsd, "tgn", DOLLAR_BOONS.tgn],
    [regenUsd, "regen", DOLLAR_BOONS.regen],
    [grantWizardUsd, "grantWizard", DOLLAR_BOONS.grantWizard],
    [wethUsd, "weth", DOLLAR_BOONS.weth],
    [wbtcUsd, "wbtc", DOLLAR_BOONS.wbtc],
    [wpolUsd, "wpol", DOLLAR_BOONS.wpol],
  ];

  for (const [value, cat, def] of dollarChecks) {
    const tier = highestTier(value, def);
    if (tier >= 0) {
      for (let i = 0; i <= tier; i++) {
        boons.push({ name: def.boons[i].name, effect: def.boons[i].effect, tier: i + 1, category: cat });
      }
    }
  }

  return boons;
}
