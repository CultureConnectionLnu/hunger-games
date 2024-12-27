import { type StateCreator } from "zustand";
import { type DeepPartial, type SubscribeStore } from "../core/zustand-helper";
import {
  getCurrentScoreDistributionOfRockPaperScissors,
  type RockPaperScissorGameScore,
  type RockPaperScissorsItem,
  type RockPaperScissorsRequirements,
} from "./rock-paper-scissors-slice";

// #region types
type VisibleTimers = "chooseTimeout" | "roundResult";

export interface RockPaperScissorsPlayerView {
  id: string;
  showView:
    | "none"
    | "choose"
    | "waiting-for-other-player-choose"
    | "show-round-results";
  timer: Record<VisibleTimers, { visible: boolean; formattedTime: string }>;
  score: {
    currentRound: number;
    roundLimit: number;
    roundsNeededToWin: number;
    yourScore: number;
    opponentScore: number;
  };
  roundResult?: {
    youChoose: RockPaperScissorsItem | undefined;
    opponentChoose: RockPaperScissorsItem | undefined;
    youWon: boolean;
    yourId: string;
    opponentId: string;
  };
}

export interface RockPaperScissorViewSlice {
  gameView: {
    mutable: {
      player1: RockPaperScissorsPlayerView;
      player2: RockPaperScissorsPlayerView;
      isPaused: boolean;
    };
    private: {
      pauseGame: () => void;
      startOrResumeGame: () => void;
      enableChoose: () => void;
      playerChoose: (playerId: string) => void;
      updateScore: (newScore: RockPaperScissorGameScore[]) => void;

      updateChooseTimeoutValue: (formattedTime: string) => void;
      updateChooseTimeoutVisibility: (visible: boolean) => void;
      updateRoundResultValue: (formattedTime: string) => void;
      updateRoundResultVisibility: (visible: boolean) => void;
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
            isPaused: mutation.isPaused ?? state.gameView.mutable.isPaused,
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
                      chooseTimeout: {
                        ...state.gameView.mutable.player1.timer.chooseTimeout,
                        ...mutation.player1.timer.chooseTimeout,
                      },
                      roundResult: {
                        ...state.gameView.mutable.player1.timer.roundResult,
                        ...mutation.player1.timer.roundResult,
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
                      chooseTimeout: {
                        ...state.gameView.mutable.player2.timer.chooseTimeout,
                        ...mutation.player2.timer.chooseTimeout,
                      },
                      roundResult: {
                        ...state.gameView.mutable.player2.timer.roundResult,
                        ...mutation.player2.timer.roundResult,
                      },
                    },
            },
          },
        },
      }));
    };

    const getPlayerSpecificKeys = (playerId: string) => {
      if (playerId === player1Id)
        return {
          currentPlayer:
            "player1" satisfies keyof RockPaperScissorViewSlice["gameView"]["mutable"],
          opponent:
            "player2" satisfies keyof RockPaperScissorViewSlice["gameView"]["mutable"],
        } as const;
      if (playerId === player2Id)
        return {
          currentPlayer:
            "player2" satisfies keyof RockPaperScissorViewSlice["gameView"]["mutable"],
          opponent:
            "player1" satisfies keyof RockPaperScissorViewSlice["gameView"]["mutable"],
        } as const;
      console.error(
        `Should be impossible, player id '${playerId}' not found. Existing player ids: '${[player1Id, player2Id].map((x) => `'${x}'`).join(", ")}'`,
      );
      // todo: find a way to kill the game in this case
      return undefined;
    };

    const initialScore = {
      currentRound: 0,
      roundLimit: 0,
      roundsNeededToWin: 0,
      yourScore: 0,
      opponentScore: 0,
    } satisfies RockPaperScissorsPlayerView["score"];

    const initialTimer = {
      chooseTimeout: {
        visible: false,
        formattedTime: "",
      },
      roundResult: { visible: false, formattedTime: "" },
    } satisfies RockPaperScissorsPlayerView["timer"];

    return {
      gameView: {
        mutable: {
          player1: {
            id: player1Id,
            score: initialScore,
            showView: "none",
            timer: initialTimer,
          },
          player2: {
            id: player2Id,
            score: initialScore,
            showView: "none",
            timer: initialTimer,
          },
          isPaused: false,
        },
        private: {
          pauseGame: () => {
            set({
              isPaused: true,
            });
          },

          startOrResumeGame: () => {
            if (get().gameView.mutable.isPaused) {
              set({ isPaused: false });
              return;
            }

            const gameOptions = get().gameLogic.options;
            set({
              player1: {
                score: {
                  currentRound: 1,
                  roundLimit: gameOptions.roundsLimit,
                  roundsNeededToWin: gameOptions.roundsNeededToWin,
                },
              },
              player2: {
                score: {
                  currentRound: 1,
                  roundLimit: gameOptions.roundsLimit,
                  roundsNeededToWin: gameOptions.roundsNeededToWin,
                },
              },
            });
          },

          enableChoose: () => {
            const { player1, player2 } = get().gameView.mutable;
            if (player1.showView === "choose" || player2.showView === "choose")
              return;

            const completedRounds = get().gameLogic.mutable.score.length;
            set({
              player1: {
                showView: "choose",
                score: {
                  currentRound: completedRounds + 1,
                },
              },
              player2: {
                showView: "choose",
                score: {
                  currentRound: completedRounds + 1,
                },
              },
            });
          },

          playerChoose: (playerId) => {
            const keys = getPlayerSpecificKeys(playerId);
            if (keys === undefined) return;

            set({
              [keys.currentPlayer]: {
                showView: "waiting-for-other-player-choose",
              },
            });

            const { player1, player2 } = get().gameView.mutable;
            if (
              player1.showView !== "waiting-for-other-player-choose" ||
              player2.showView !== "waiting-for-other-player-choose"
            )
              return;

            set({
              player1: {
                showView: "show-round-results",
              },
              player2: {
                showView: "show-round-results",
              },
            });
          },

          updateScore: (newScore) => {
            const overallScore = getCurrentScoreDistributionOfRockPaperScissors(
              player1Id,
              player2Id,
              newScore,
            );
            const player1Wins = overallScore[player1Id]!;
            const player2Wins = overallScore[player2Id]!;

            const { item: player1Item } = get().gameLogic.mutable.player1;
            const { item: player2Item } = get().gameLogic.mutable.player2;
            const winner = newScore.at(-1)?.winnerId;

            set({
              player1: {
                score: {
                  yourScore: player1Wins,
                  opponentScore: player2Wins,
                },
                roundResult: {
                  opponentChoose: player2Item,
                  youChoose: player1Item,
                  opponentId: player2Id,
                  yourId: player1Id,
                  youWon: winner === player1Id,
                },
              },
              player2: {
                score: {
                  yourScore: player2Wins,
                  opponentScore: player1Wins,
                },
                roundResult: {
                  opponentChoose: player1Item,
                  youChoose: player2Item,
                  opponentId: player1Id,
                  yourId: player2Id,
                  youWon: winner === player2Id,
                },
              },
            });
          },

          updateChooseTimeoutValue: (formattedTime: string) => {
            set({
              player1: {
                timer: {
                  chooseTimeout: {
                    formattedTime,
                  },
                },
              },
              player2: {
                timer: {
                  chooseTimeout: {
                    formattedTime,
                  },
                },
              },
            });
          },

          updateChooseTimeoutVisibility: (visible: boolean) => {
            set({
              player1: {
                timer: {
                  chooseTimeout: {
                    visible,
                  },
                },
              },
              player2: {
                timer: {
                  chooseTimeout: {
                    visible,
                  },
                },
              },
            });
          },

          updateRoundResultValue: (formattedTime: string) => {
            set({
              player1: {
                timer: {
                  roundResult: {
                    formattedTime,
                  },
                },
              },
              player2: {
                timer: {
                  roundResult: {
                    formattedTime,
                  },
                },
              },
            });
          },

          updateRoundResultVisibility: (visible: boolean) => {
            set({
              player1: {
                timer: {
                  roundResult: {
                    visible,
                  },
                },
              },
              player2: {
                timer: {
                  roundResult: {
                    visible,
                  },
                },
              },
            });
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

  unsubscribes.push(...handleGameStartedEvent(store));
  unsubscribes.push(...handleCanChooseChange(store));
  unsubscribes.push(...handleRoundResultUpdate(store));
  unsubscribes.push(...handleChooseTimeoutUpdate(store));
  unsubscribes.push(...handleRoundResultTimerUpdate(store));

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

function handleGameStartedEvent(
  store: SubscribeStore<RockPaperScissorsViewRequirements>,
) {
  const { startOrResumeGame, pauseGame } = store.getState().gameView.private;
  return [
    store.subscribe(
      (state) => state.playerConnection.mutable.gameIsRunning,
      (gameIsRunning) => {
        if (gameIsRunning) startOrResumeGame();
        else pauseGame();
      },
    ),
  ];
}

function handleCanChooseChange(
  store: SubscribeStore<RockPaperScissorsViewRequirements>,
) {
  const { id: player1Id } = store.getState().gameView.mutable.player1;
  const { id: player2Id } = store.getState().gameView.mutable.player2;
  const { enableChoose, playerChoose } = store.getState().gameView.private;
  return [
    store.subscribe(
      (state) =>
        [
          state.gameLogic.mutable.player1.canChoose,
          state.gameLogic.mutable.player1.item,
        ] as const,
      (current, previous) => {
        if (current[0] === previous[0] && current[1] === previous[1]) return;

        const [canChoose, item] = current;
        if (canChoose && item === undefined) {
          enableChoose();
        }
        if (item !== undefined) {
          playerChoose(player1Id);
        }
      },
    ),
    store.subscribe(
      (state) =>
        [
          state.gameLogic.mutable.player2.canChoose,
          state.gameLogic.mutable.player2.item,
        ] as const,
      (current, previous) => {
        if (current[0] === previous[0] && current[1] === previous[1]) return;

        const [canChoose, item] = current;
        if (canChoose && item === undefined) {
          enableChoose();
        }
        if (item !== undefined) {
          playerChoose(player2Id);
        }
      },
    ),
  ];
}

function handleRoundResultUpdate(
  store: SubscribeStore<RockPaperScissorsViewRequirements>,
) {
  const { updateScore } = store.getState().gameView.private;
  return [
    store.subscribe((state) => state.gameLogic.mutable.score, updateScore),
  ];
}

function handleChooseTimeoutUpdate(
  store: SubscribeStore<RockPaperScissorsViewRequirements>,
) {
  const { updateChooseTimeoutValue, updateChooseTimeoutVisibility } =
    store.getState().gameView.private;
  return [
    store.subscribe(
      (state) => state.timerRpsChooseTimeout.mutable.formattedTime,
      updateChooseTimeoutValue,
    ),
    store.subscribe(
      (state) => state.timerRpsChooseTimeout.mutable.isActive,
      updateChooseTimeoutVisibility,
    ),
  ];
}

function handleRoundResultTimerUpdate(
  store: SubscribeStore<RockPaperScissorsViewRequirements>,
) {
  const { updateRoundResultValue, updateRoundResultVisibility } =
    store.getState().gameView.private;
  return [
    store.subscribe(
      (state) => state.timerRpsShowCurrentScore.mutable.formattedTime,
      updateRoundResultValue,
    ),
    store.subscribe(
      (state) => state.timerRpsShowCurrentScore.mutable.isActive,
      updateRoundResultVisibility,
    ),
  ];
}
