"use client";

import { useReducer, useCallback } from "react";
import type { NftCharacter } from "./useNftStats";
import { computeStats } from "@/lib/battleStats";
import { resolveCombat } from "@/lib/cardBattleCombat";
import type { GameState, GameAction, Board, BoardCard, PlayerState } from "@/lib/cardBattleTypes";
import { FORTRESS_HP, BOARD_COLS, INITIAL_DRAW, DRAW_PER_TURN } from "@/lib/cardBattleTypes";

function emptyBoard(): Board {
  return Array.from({ length: BOARD_COLS }, () => [null, null]);
}

function drawCards(player: PlayerState, count: number): PlayerState {
  const toDraw = Math.min(count, player.deck.length, 7 - player.hand.length);
  if (toDraw <= 0) return player;
  return {
    ...player,
    hand: [...player.hand, ...player.deck.slice(0, toDraw)],
    deck: player.deck.slice(toDraw),
  };
}

function makeBoardCard(character: NftCharacter): BoardCard {
  const stats = computeStats(character.stats);
  return { character, stats, currentHp: stats.hp, maxHp: stats.hp, burns: [] };
}

function applyDamageToBoard(board: Board, damage: Map<string, number>): Board {
  return board.map((col, c) =>
    col.map((card, r) => {
      if (!card) return null;
      const key = `${c}-${r}`;
      const dmg = damage.get(key) ?? 0;
      if (dmg <= 0) return card;
      const newHp = card.currentHp - dmg;
      if (newHp <= 0) return null; // card destroyed
      return { ...card, currentHp: newHp };
    })
  );
}

const initialState: GameState = {
  phase: "setup",
  players: [
    { deck: [], hand: [], board: emptyBoard(), fortressHp: FORTRESS_HP },
    { deck: [], hand: [], board: emptyBoard(), fortressHp: FORTRESS_HP },
  ],
  turnNumber: 0,
  combatLog: [],
  winner: null,
  selectedHandIndex: null,
};

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "INIT_GAME": {
      let p1: PlayerState = { deck: action.deck1, hand: [], board: emptyBoard(), fortressHp: FORTRESS_HP };
      let p2: PlayerState = { deck: action.deck2, hand: [], board: emptyBoard(), fortressHp: FORTRESS_HP };
      p1 = drawCards(p1, INITIAL_DRAW);
      p2 = drawCards(p2, INITIAL_DRAW);
      return { ...initialState, phase: "p1Place", players: [p1, p2], turnNumber: 1 };
    }

    case "SELECT_CARD": {
      return { ...state, selectedHandIndex: action.handIndex };
    }

    case "PLACE_CARD": {
      const pIdx = state.phase === "p1Place" ? 0 : 1;
      const player = state.players[pIdx];
      if (state.selectedHandIndex === null) return state;
      if (action.col < 0 || action.col >= BOARD_COLS || action.row < 0 || action.row > 1) return state;
      if (player.board[action.col][action.row] !== null) return state;

      const card = player.hand[state.selectedHandIndex];
      if (!card) return state;

      const newHand = player.hand.filter((_, i) => i !== state.selectedHandIndex);
      const newBoard = player.board.map((col, c) =>
        col.map((slot, r) => (c === action.col && r === action.row ? makeBoardCard(card) : slot))
      );

      const newPlayers = [...state.players] as [PlayerState, PlayerState];
      newPlayers[pIdx] = { ...player, hand: newHand, board: newBoard };
      // One card per turn — auto-advance
      const nextPhase = state.phase === "p1Place" ? "passToP2" : "combat";
      return { ...state, players: newPlayers, selectedHandIndex: null, phase: nextPhase as GameState["phase"] };
    }

    case "DRAG_PLACE_CARD": {
      const pIdx = state.phase === "p1Place" ? 0 : 1;
      const player = state.players[pIdx];
      if (action.col < 0 || action.col >= BOARD_COLS || action.row < 0 || action.row > 1) return state;
      if (player.board[action.col][action.row] !== null) return state;
      const card = player.hand[action.handIndex];
      if (!card) return state;
      const newHand = player.hand.filter((_, i) => i !== action.handIndex);
      const newBoard = player.board.map((col, c) =>
        col.map((slot, r) => (c === action.col && r === action.row ? makeBoardCard(card) : slot))
      );
      const newPlayers = [...state.players] as [PlayerState, PlayerState];
      newPlayers[pIdx] = { ...player, hand: newHand, board: newBoard };
      const nextPhaseDrag = state.phase === "p1Place" ? "passToP2" : "combat";
      return { ...state, players: newPlayers, selectedHandIndex: null, phase: nextPhaseDrag as GameState["phase"] };
    }

    case "END_PLACEMENT": {
      if (state.phase === "p1Place") {
        return { ...state, phase: "passToP2", selectedHandIndex: null };
      }
      if (state.phase === "p2Place") {
        return { ...state, phase: "combat", selectedHandIndex: null };
      }
      return state;
    }

    case "PASS_DONE": {
      return { ...state, phase: "p2Place" };
    }

    case "AI_TURN": {
      // Simple AI: pick the strongest card from hand, place in best slot
      const ai = state.players[1];
      if (ai.hand.length === 0) {
        // No cards — skip to combat
        return { ...state, phase: "combat", selectedHandIndex: null };
      }

      // Pick the card with highest total stats
      let bestIdx = 0;
      let bestScore = -1;
      ai.hand.forEach((card, i) => {
        const s = card.stats;
        const score = s.attack + s.mAtk + s.fAtk + s.hp + s.def + s.mDef + s.mana;
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      });

      // Find best slot: prefer front row in columns with no front card, then empty columns, then back row
      let targetCol = -1;
      let targetRow = -1;

      // Priority 1: front row in column that has a back row card but no front (support the back)
      for (let c = 0; c < BOARD_COLS; c++) {
        if (ai.board[c][1] === null && ai.board[c][0] !== null) { targetCol = c; targetRow = 1; break; }
      }
      // Priority 2: front row in empty column
      if (targetCol === -1) {
        for (let c = 0; c < BOARD_COLS; c++) {
          if (ai.board[c][1] === null && ai.board[c][0] === null) { targetCol = c; targetRow = 1; break; }
        }
      }
      // Priority 3: back row behind an existing front card
      if (targetCol === -1) {
        for (let c = 0; c < BOARD_COLS; c++) {
          if (ai.board[c][0] === null && ai.board[c][1] !== null) { targetCol = c; targetRow = 0; break; }
        }
      }
      // Priority 4: any empty slot
      if (targetCol === -1) {
        for (let c = 0; c < BOARD_COLS; c++) {
          for (let r = 1; r >= 0; r--) {
            if (ai.board[c][r] === null) { targetCol = c; targetRow = r; break; }
          }
          if (targetCol !== -1) break;
        }
      }

      if (targetCol === -1) {
        // Board full — skip to combat
        return { ...state, phase: "combat", selectedHandIndex: null };
      }

      const card = ai.hand[bestIdx];
      const newHand = ai.hand.filter((_, i) => i !== bestIdx);
      const newBoard = ai.board.map((col, c) =>
        col.map((slot, r) => (c === targetCol && r === targetRow ? makeBoardCard(card) : slot))
      );
      const newPlayers = [...state.players] as [PlayerState, PlayerState];
      newPlayers[1] = { ...ai, hand: newHand, board: newBoard };
      return { ...state, players: newPlayers, selectedHandIndex: null, phase: "combat" };
    }

    case "RESOLVE_COMBAT": {
      const [p1, p2] = state.players;
      const result = resolveCombat(p1.board, p2.board);

      // Apply damage to the boards returned by combat (which have updated burn state)
      const newBoard1 = applyDamageToBoard(result.newBoard1, result.board1Damage);
      const newBoard2 = applyDamageToBoard(result.newBoard2, result.board2Damage);
      const newFortress1 = Math.max(0, p1.fortressHp - result.fortress1Dmg);
      const newFortress2 = Math.max(0, p2.fortressHp - result.fortress2Dmg);

      let winner: 1 | 2 | null = null;
      if (newFortress1 <= 0 && newFortress2 <= 0) winner = result.fortress1Dmg < result.fortress2Dmg ? 1 : 2;
      else if (newFortress1 <= 0) winner = 2;
      else if (newFortress2 <= 0) winner = 1;

      // Draw cards for next turn
      let updatedP1: PlayerState = { ...p1, board: newBoard1, fortressHp: newFortress1 };
      let updatedP2: PlayerState = { ...p2, board: newBoard2, fortressHp: newFortress2 };

      if (!winner) {
        updatedP1 = drawCards(updatedP1, DRAW_PER_TURN);
        updatedP2 = drawCards(updatedP2, DRAW_PER_TURN);
      }

      return {
        ...state,
        players: [updatedP1, updatedP2],
        combatLog: [...state.combatLog, ...result.events],
        phase: winner ? "gameOver" : "p1Place",
        turnNumber: winner ? state.turnNumber : state.turnNumber + 1,
        winner,
        selectedHandIndex: null,
      };
    }

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

export function useCardBattle() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const initGame = useCallback((deck1: NftCharacter[], deck2: NftCharacter[]) => {
    dispatch({ type: "INIT_GAME", deck1, deck2 });
  }, []);

  const selectCard = useCallback((handIndex: number) => {
    dispatch({ type: "SELECT_CARD", handIndex });
  }, []);

  const placeCard = useCallback((col: number, row: number) => {
    dispatch({ type: "PLACE_CARD", col, row });
  }, []);

  const dragPlaceCard = useCallback((handIndex: number, col: number, row: number) => {
    dispatch({ type: "DRAG_PLACE_CARD", handIndex, col, row });
  }, []);

  const endPlacement = useCallback(() => {
    dispatch({ type: "END_PLACEMENT" });
  }, []);

  const passDone = useCallback(() => {
    dispatch({ type: "PASS_DONE" });
  }, []);

  const resolveCombatAction = useCallback(() => {
    dispatch({ type: "RESOLVE_COMBAT" });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  const aiTurn = useCallback(() => {
    dispatch({ type: "AI_TURN" });
  }, []);

  return { state, initGame, selectCard, placeCard, dragPlaceCard, endPlacement, passDone, aiTurn, resolveCombat: resolveCombatAction, reset };
}
