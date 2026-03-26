import type { NftCharacter } from "@/hooks/useNftStats";

// NFT supply — cards with more copies are more common in random decks
const NFT_SUPPLY: Record<string, number> = {
  "0x234b58ecdb0026b2aaf829cc46e91895f609f6d1": 300,  // Guards of Kardov's Gate
  "0x2953399124f0cbb46d2cbacd8a89cf0599974963": 1163, // Space Donkeys
  "0xcb8c8a116ac3e12d861c1b4bd0d859aceda25d3f": 80,   // MycoVault
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Weighted random pick — cards with higher supply are proportionally more likely */
function weightedPick(characters: NftCharacter[], count: number): NftCharacter[] {
  const weights = characters.map((c) => NFT_SUPPLY[c.contractAddress.toLowerCase()] ?? 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const picked: NftCharacter[] = [];
  const usedIndices = new Set<number>();

  while (picked.length < count && usedIndices.size < characters.length) {
    let roll = Math.random() * totalWeight;
    for (let i = 0; i < characters.length; i++) {
      if (usedIndices.has(i)) continue;
      roll -= weights[i];
      if (roll <= 0) {
        picked.push(characters[i]);
        usedIndices.add(i);
        break;
      }
    }
  }
  return picked;
}

/**
 * Build a deck of `deckSize` cards.
 * @param chosen - specific cards the player picked (up to deckSize)
 * @param allCharacters - full pool to fill remaining slots from
 */
export function buildDeck(
  allCharacters: NftCharacter[],
  chosen: NftCharacter[] = [],
  deckSize = 60,
): NftCharacter[] {
  const chosenAddrs = new Set(chosen.map((c) => c.contractAddress.toLowerCase()));
  const remaining = allCharacters.filter((c) => !chosenAddrs.has(c.contractAddress.toLowerCase()));
  const fillCount = Math.max(0, deckSize - chosen.length);
  const filler = weightedPick(remaining, fillCount);
  return shuffle([...chosen.slice(0, deckSize), ...filler]);
}
