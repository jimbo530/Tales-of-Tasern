import type { NftCharacter } from "@/hooks/useNftStats";
import type { ComputedStats } from "./battleStats";

export type PlayerID = 1 | 2;

export type Phase =
  | "setup"
  | "p1Place"
  | "passToP2"
  | "p2Place"
  | "combat"
  | "gameOver";

export type BoardCard = {
  character: NftCharacter;
  stats: ComputedStats;
  currentHp: number;
  maxHp: number;
  burns: number[]; // pending fire DoT damage for future turns
};

// board[col][row] — row 0 = back, row 1 = front
export type Board = (BoardCard | null)[][];

export type PlayerState = {
  deck: NftCharacter[];
  hand: NftCharacter[];
  board: Board; // [5 cols][2 rows]
  fortressHp: number;
};

export type CombatEvent = {
  col: number;
  attackerPlayer: PlayerID;
  attackerName: string;
  targetName: string; // card name or "Fortress"
  physDmg: number;
  magicDmg: number;
  fireDmg: number;
  manaDmg: number;
  totalDmg: number;
};

export type GameState = {
  phase: Phase;
  players: [PlayerState, PlayerState];
  turnNumber: number;
  combatLog: CombatEvent[];
  winner: PlayerID | null;
  selectedHandIndex: number | null;
};

export type GameAction =
  | { type: "INIT_GAME"; deck1: NftCharacter[]; deck2: NftCharacter[] }
  | { type: "SELECT_CARD"; handIndex: number }
  | { type: "PLACE_CARD"; col: number; row: number }
  | { type: "DRAG_PLACE_CARD"; handIndex: number; col: number; row: number }
  | { type: "END_PLACEMENT" }
  | { type: "PASS_DONE" }
  | { type: "AI_TURN" }
  | { type: "RESOLVE_COMBAT" }
  | { type: "RESET" };

export const FORTRESS_HP = 10_000;
export const BOARD_COLS = 5;
export const HAND_SIZE = 5;
export const INITIAL_DRAW = 5;
export const DRAW_PER_TURN = 1;
export const BACK_ROW_SUPPORT = 0.2; // 20% DEF/MDEF bonus
