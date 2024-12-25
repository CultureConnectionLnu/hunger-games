import { type StateCreator } from "zustand";
import { type SubscribeStore, type DeepPartial } from "../core/zustand-helper";
import {
  type RockPaperScissorsItem,
  type RockPaperScissorsRequirements,
} from "./rock-paper-scissors-slice";

// #region types
type VisibleTimers = "startTimeout" | "otherPlayerDisconnect";

interface PlayerView {
  id: string;
  showView: "choose" | "waiting-for-other-player-choose" | "show-round-results";
  timer: Record<VisibleTimers, { visible: boolean; formattedTime: string }>;
  score: {
    currentRound: number;
    roundLimit: number;
    yourScore: number;
    opponentScore: number;
  };
  roundResult?: {
    youChoose: RockPaperScissorsItem;
    opponentChoose: RockPaperScissorsItem;
    youWon: boolean;
    yourId: string;
    opponentId: string;
  };
}

export interface RockPaperScissorViewSlice {
  gameView: {
    mutable: {
      player1: PlayerView;
      player2: PlayerView;
    };
    private: {
      onChoose: () => void;
    };
  };
}

export type RockPaperScissorsViewRequirements = RockPaperScissorViewSlice &
  RockPaperScissorsRequirements;

// #endregion

export function createRockPaperScissorsViewSlice(
  player1Id: string,
  player2Id: string,
): StateCreator<
  RockPaperScissorsViewRequirements,
  [],
  [],
  RockPaperScissorViewSlice
> {
  return function rockPaperScissorsViewSlice(originalSet, get) {
    const set = function setRockPaperScissorsViewSlice(
      mutation: DeepPartial<RockPaperScissorViewSlice["gameView"]["mutable"]>,
    ) {
      originalSet((state) => ({
        gameView: {
          ...state.gameView,
          mutable: {
            player1: {
              ...state.gameView.mutable.player1,
              ...mutation.player1,
              score:
                mutation.player1?.score === undefined
                  ? state.gameView.mutable.player1.score
                  : {
                      ...state.gameView.mutable.player1.score,
                      ...mutation.player1.score,
                    },
              timer:
                mutation.player1?.timer === undefined
                  ? state.gameView.mutable.player1.timer
                  : {
                      otherPlayerDisconnect: {
                        ...state.gameView.mutable.player1.timer
                          .otherPlayerDisconnect,
                        ...mutation.player1.timer.otherPlayerDisconnect,
                      },
                      startTimeout: {
                        ...state.gameView.mutable.player1.timer.startTimeout,
                        ...mutation.player1.timer.startTimeout,
                      },
                    },
            },
            player2: {
              ...state.gameView.mutable.player2,
              ...mutation.player2,
              score:
                mutation.player2?.score === undefined
                  ? state.gameView.mutable.player2.score
                  : {
                      ...state.gameView.mutable.player2.score,
                      ...mutation.player2.score,
                    },

              timer:
                mutation.player2?.timer === undefined
                  ? state.gameView.mutable.player2.timer
                  : {
                      otherPlayerDisconnect: {
                        ...state.gameView.mutable.player2.timer
                          .otherPlayerDisconnect,
                        ...mutation.player2.timer.otherPlayerDisconnect,
                      },
                      startTimeout: {
                        ...state.gameView.mutable.player2.timer.startTimeout,
                        ...mutation.player2.timer.startTimeout,
                      },
                    },
            },
          },
        },
      }));
    };

    const initialScore = {
      currentRound: 0,
      roundLimit: 0,
      yourScore: 0,
      opponentScore: 0,
    };
    const initialTimer = {
      startTimeout: {
        visible: false,
        formattedTime: "",
      },
      otherPlayerDisconnect: { visible: false, formattedTime: "" },
    };

    return {
      gameView: {
        mutable: {
          player1: {
            id: player1Id,
            score: initialScore,
            showView: "choose",
            timer: initialTimer,
          },
          player2: {
            id: player2Id,
            score: initialScore,
            showView: "choose",
            timer: initialTimer,
          },
        },
        private: {
          onChoose: () => {
            // todo
          },
        },
      },
    };
  };
}

export function registerRockPaperScissorsViewSubscribers(
  store: SubscribeStore<RockPaperScissorsViewRequirements>,
) {
  const unsubscribes: (() => void)[] = [];

  handleGameEndedEvent(store, unsubscribes);
}

function handleGameEndedEvent(
  store: SubscribeStore<RockPaperScissorsViewRequirements>,
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
