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

type Item = "rock" | "paper" | "scissors";

interface PlayerState {
  id: string;
  item: Item | undefined;
  canChoose: boolean;
}

type GameScore = { type: "tie" } | { type: "win"; winnerId: string };

interface RockPaperScissorsSlice {
  gameLogic: {
    mutable: {
      player1: PlayerState;
      player2: PlayerState;
      score: GameScore[];
    };
    chooseItem(playerId: string, item: Item): void;
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
          // todo
        },
      }));
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
        chooseItem: (playerId, item) => {},
        onChooseTimeout: () => {},
        pauseGame: () => {},
        startOrResumeGame: () => {},
      },
    };
  };
}

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
