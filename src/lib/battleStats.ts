import type { NftCharacter } from "@/hooks/useNftStats";

export type ComputedStats = {
  attack: number;
  mAtk: number;
  fAtk: number;
  def: number;
  mDef: number;
  hp: number;
  healing: number;
  mana: number;
};

export function computeStats(raw: NftCharacter["stats"]): ComputedStats {
  const multiplier = 1 + raw.charMultiplier;
  const magicMult = 1 + raw.magicMultiplier;
  return {
    attack: raw.attack * multiplier,
    mAtk:   raw.mAtk * multiplier * magicMult,
    fAtk:   raw.fAtk * multiplier,
    def:    raw.def * multiplier,
    mDef:   raw.mDef * multiplier * magicMult,
    hp:     raw.hp * multiplier,
    healing: (raw.healing ?? 0) * multiplier,
    mana:   raw.mana * multiplier,
  };
}
