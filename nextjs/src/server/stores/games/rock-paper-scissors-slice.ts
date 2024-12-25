import { type StateCreator } from "zustand";
import { type GameResultSlice } from "../core/game-result-slice";
import { type PlayerConnectionSlice } from "../core/player-connection-state-slice";
import { type TimerSlice } from "../core/timer-slice";
import { type DeepPartial, type SubscribeStore } from "../core/zustand-helper";

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
      player1: RockPaperScissorsItem | undefined;
      player2: RockPaperScissorsItem | undefined;
    }
  | {
      type: "win";
      winnerId: string;
      player1: RockPaperScissorsItem | undefined;
      player2: RockPaperScissorsItem | undefined;
    };

export type RockPaperScissorsOptions = {
  roundsLimit: number;
  roundsNeededToWin: number;
};

export interface RockPaperScissorsSlice {
  gameLogic: {
    mutable: {
      player1: PlayerState;
      player2: PlayerState;
      score: RockPaperScissorGameScore[];
    };
    options: RockPaperScissorsOptions;
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
  options: RockPaperScissorsOptions,
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

    const endTheRound = () => {
      const { player1, player2, score } = get().gameLogic.mutable;
      set({
        score: [
          ...score,
          getOutcome(player1.id, player2.id, player1.item, player2.item),
        ],
        player1: {
          canChoose: false,
        },
        player2: {
          canChoose: false,
        },
      });

      const overAllWinner = hasOverallWinner(
        player1Id,
        player2Id,
        options,
        get().gameLogic.mutable.score,
      );
      if (overAllWinner === undefined) {
        get().timerRpsChooseTimeout.cancel();
        get().timerRpsShowCurrentScore.startOrResume();
        return;
      }

      if (overAllWinner.type === "tie") {
        get().gameResult.gameTied();
      } else {
        get().gameResult.gameWon(overAllWinner.winner, overAllWinner.looser);
      }
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
        options,
        chooseItem: (playerId, item) => {
          const keys = getPlayerSpecificKeys(playerId);
          if (keys === undefined) return;

          if (get().gameLogic.mutable[keys.playerKey].canChoose === false)
            return "choosing is disabled";
          if (get().gameLogic.mutable[keys.playerKey].item !== undefined)
            return "player already chosen";

          set({
            [keys.playerKey]: {
              item,
            },
          });

          const { player1, player2 } = get().gameLogic.mutable;
          if (player1.item === undefined || player2.item === undefined) return;

          endTheRound();
        },

        onChooseTimeout: () => {
          endTheRound();
        },
        pauseGame: () => {},
        startOrResumeGame: () => {
          set({
            player1: {
              canChoose: true,
              item: undefined,
            },
            player2: {
              canChoose: true,
              item: undefined,
            },
          });

          get().timerRpsChooseTimeout.startOrResume();
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
  unsubscribes.push(...handleChooseTimeout(store));
  unsubscribes.push(...handleNextRoundTimeout(store));

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

function handleChooseTimeout(
  store: SubscribeStore<RockPaperScissorsRequirements>,
) {
  return [
    store.subscribe(
      (state) => state.timerRpsChooseTimeout.mutable.completed,
      (completed) => {
        if (completed === false) return;

        const { canceled } = store.getState().timerRpsChooseTimeout.mutable;
        if (canceled) return;

        store.getState().gameLogic.onChooseTimeout();
      },
    ),
  ];
}

function handleNextRoundTimeout(
  store: SubscribeStore<RockPaperScissorsRequirements>,
) {
  return [
    store.subscribe(
      (state) => state.timerRpsShowCurrentScore.mutable.completed,
      (completed) => {
        if (completed === false) return;

        const { canceled } = store.getState().timerRpsShowCurrentScore.mutable;
        if (canceled) return;

        store.getState().timerRpsChooseTimeout.reset();
        store.getState().timerRpsShowCurrentScore.reset();
        store.getState().gameLogic.startOrResumeGame();
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
  player1Item?: RockPaperScissorsItem,
  player2Item?: RockPaperScissorsItem,
): RockPaperScissorGameScore {
  const base = {
    player1: player1Item,
    player2: player2Item,
  };
  if (player1Item === player2Item) return { type: "tie", ...base };

  if (player1Item !== undefined && player2Item === undefined)
    return { type: "win", winnerId: player1Id, ...base };
  if (player1Item === undefined && player2Item !== undefined)
    return { type: "win", winnerId: player2Id, ...base };

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

function hasOverallWinner(
  player1Id: string,
  player2Id: string,
  options: RockPaperScissorsOptions,
  score: RockPaperScissorGameScore[],
) {
  const roundsPlayed = score.length;
  const currentWinRates = score.reduce<Record<string, number>>(
    (acc, cur) => {
      if (cur.type === "win") {
        acc[cur.winnerId]!++;
      } else {
        acc.tie!++;
      }
      return acc;
    },
    { [player1Id]: 0, [player2Id]: 0, tie: 0 },
  );

  const player1Wins = currentWinRates[player1Id]!;
  const player2Wins = currentWinRates[player2Id]!;

  if (player1Wins >= options.roundsNeededToWin)
    return { type: "win", winner: player1Id, looser: player2Id } as const;
  if (player2Wins >= options.roundsNeededToWin)
    return { type: "win", winner: player2Id, looser: player1Id } as const;

  if (roundsPlayed === options.roundsLimit) {
    if (player1Wins === player2Wins) return { type: "tie" } as const;

    if (player1Wins > player2Wins) {
      return { type: "win", winner: player1Id, looser: player2Id } as const;
    } else {
      return { type: "win", winner: player2Id, looser: player1Id } as const;
    }
  }

  return undefined;
}
// #endregion
