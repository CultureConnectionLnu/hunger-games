import { type StateCreator } from "zustand";
import { type GameResultSlice } from "../core/game-result-slice";
import { type SubscribeStore, type DeepPartial } from "../core/zustand-helper";
import { type TimerSlice } from "../core/timer-slice";
import { type PlayerConnectionSlice } from "../core/player-connection-state-slice";

// #region types

declare global {
  interface KnownTimerNamesMap {
    timerRpsChooseTimeout: string;
    timerRpsShowCurrentScore: string;
  }
}

export type RockPaperScissorsItem = "rock" | "paper" | "scissors";

interface PlayerState {
  id: string;
  item: RockPaperScissorsItem | undefined;
  canChoose: boolean;
}

export type RockPaperScissorGameScore =
  | {
      type: "tie";
      winnerId?: undefined;
      player1: RockPaperScissorsItem;
      player2: RockPaperScissorsItem;
    }
  | {
      type: "win";
      winnerId: string;
      player1: RockPaperScissorsItem;
      player2: RockPaperScissorsItem;
    };

export interface RockPaperScissorsSlice {
  gameLogic: {
    mutable: {
      player1: PlayerState;
      player2: PlayerState;
      score: RockPaperScissorGameScore[];
    };
    chooseItem(playerId: string, item: RockPaperScissorsItem): void;
    onChooseTimeout(): void;
    pauseGame: () => void;
    startOrResumeGame: () => void;
  };
}

export type RockPaperScissorsRequirements = RockPaperScissorsSlice &
  PlayerConnectionSlice &
  GameResultSlice &
  TimerSlice<"timerRpsChooseTimeout" | "timerRpsShowCurrentScore">;
// #endregion

export function createRockPaperScissorsSlice(
  player1Id: string,
  player2Id: string,
): StateCreator<RockPaperScissorsRequirements, [], [], RockPaperScissorsSlice> {
  return function rockPaperScissorsSlice(originalSet, get) {
    const set = function setRockPaperScissorsSlice(
      mutation: DeepPartial<RockPaperScissorsSlice["gameLogic"]["mutable"]>,
    ) {
      originalSet((state) => ({
        gameLogic: {
          ...state.gameLogic,
          mutable: {
            ...state.gameLogic.mutable,
            ...mutation,
            player1: {
              ...state.gameLogic.mutable.player1,
              ...mutation.player1,
            },
            player2: {
              ...state.gameLogic.mutable.player2,
              ...mutation.player2,
            },
          },
        },
      }));
    };

    const getPlayerSpecificKeys = (playerId: string) => {
      if (playerId === player1Id)
        return {
          playerKey:
            "player1" satisfies keyof PlayerConnectionSlice["playerConnection"]["mutable"],
        } as const;
      if (playerId === player2Id)
        return {
          playerKey:
            "player2" satisfies keyof PlayerConnectionSlice["playerConnection"]["mutable"],
        } as const;
      return undefined;
    };

    return {
      gameLogic: {
        mutable: {
          player1: {
            id: player1Id,
            item: undefined,
            canChoose: false,
          },
          player2: {
            id: player2Id,
            item: undefined,
            canChoose: false,
          },
          score: [],
        },
        chooseItem: (playerId, item) => {
          const keys = getPlayerSpecificKeys(playerId);
          if (keys === undefined) return;

          if (get().gameLogic.mutable[keys.playerKey].item !== undefined)
            return "player already chosen";

          set({
            [keys.playerKey]: {
              item,
            },
          });

          const { player1, player2, score } = get().gameLogic.mutable;
          if (player1.item === undefined || player2.item === undefined) return;

          set({
            score: [
              ...score,
              getOutcome(player1.id, player2.id, player1.item, player2.item),
            ],
          });
        },
        onChooseTimeout: () => {},
        pauseGame: () => {},
        startOrResumeGame: () => {
          set({
            player1: {
              canChoose: true,
            },
            player2: {
              canChoose: true,
            },
          });
        },
      },
    };
  };
}

// #region subscriptions

export function registerRockPaperScissorsSubscribers(
  store: SubscribeStore<RockPaperScissorsRequirements>,
) {
  const unsubscribes: (() => void)[] = [];

  unsubscribes.push(...handleGameRunningEvent(store));

  cleanupUponGameCompleted(store, unsubscribes);
}

function handleGameRunningEvent(
  store: SubscribeStore<RockPaperScissorsRequirements>,
) {
  return [
    store.subscribe(
      (state) => state.playerConnection.mutable.gameIsRunning,
      (gameRunning) => {
        if (gameRunning) {
          store.getState().gameLogic.startOrResumeGame();
        }
      },
    ),
  ];
}

function cleanupUponGameCompleted(
  store: SubscribeStore<RockPaperScissorsRequirements>,
  unsubscribes: (() => void)[],
) {
  const unSub = store.subscribe(
    (state) => state.gameResult.outcome,
    (outcome) => {
      if (outcome.result === "ongoing") return;

      unsubscribes.forEach((unSub) => unSub());
    },
  );
  unsubscribes.push(unSub);
}

// #endregion

// #region helper functions

function getOutcome(
  player1Id: string,
  player2Id: string,
  player1Item: RockPaperScissorsItem,
  player2Item: RockPaperScissorsItem,
): RockPaperScissorGameScore {
  const base = {
    player1: player1Item,
    player2: player2Item,
  };
  if (player1Item === player2Item) return { type: "tie", ...base };

  if (player1Item === "rock") {
    if (player2Item === "scissors")
      return { type: "win", winnerId: player1Id, ...base };
    if (player2Item === "paper")
      return { type: "win", winnerId: player2Id, ...base };
  }

  if (player1Item === "scissors") {
    if (player2Item === "rock")
      return { type: "win", winnerId: player2Id, ...base };
    if (player2Item === "paper")
      return { type: "win", winnerId: player1Id, ...base };
  }

  if (player1Item === "paper") {
    if (player2Item === "rock")
      return { type: "win", winnerId: player1Id, ...base };
    if (player2Item === "scissors")
      return { type: "win", winnerId: player2Id, ...base };
  }

  return { type: "tie", ...base };
}
// #endregion
