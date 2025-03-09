import { type StateCreator } from "zustand";
import { type PlayerConnectionSliceRequirements } from "./player-connection-state-slice";
import { type DeepPartial, type SubscribeStore } from "./zustand-helper";
import { type GameResultSlice } from "./game-result-slice";

// #region types

type VisibleTimers = "startTimeout" | "otherPlayerDisconnect";

export interface ConnectionPlayerView {
  nextActions: "ready"[];
  showView: // before the game starts
  | "joining"
    | "ready-button"
    | "waiting-for-other-player-joining"
    | "waiting-for-other-player-ready"
    // if a user disconnects before the game starts
    | "waiting-for-other-player-reconnect"
    // during the game
    | "game"
    | "game-paused"
    // after the game
    | "game-ended";
  timer: Record<
    VisibleTimers,
    {
      visible: boolean;
      formattedTime: string;
    }
  >;
  id: string;
  outcome?: {
    result: "tie" | "win" | "loose";
    yourId: string;
    opponentId: string;
    reason: NonNullable<GameResultSlice["gameResult"]["outcome"]["reason"]>;
  };
}

export interface ConnectionViewSlice {
  connectedView: {
    mutable: {
      player1: ConnectionPlayerView;
      player2: ConnectionPlayerView;
    };
    private: {
      updateViews: () => void;
      showGameEndedView: (
        outcome: GameResultSlice["gameResult"]["outcome"],
      ) => void;
      updateStartTimeoutValue: (formattedTime: string) => void;
      updateDisconnectedLooseValue: (
        formattedTime: string,
        playerId: string,
      ) => void;
    };
  };
}

export type ConnectedViewRequirements = PlayerConnectionSliceRequirements &
  ConnectionViewSlice;

// #endregion

/**
 * This slice provides individual views for each player.
 * Given one game, there should be two views.
 * This is the first view, which manges the game environment.
 * The second view is the game itself.
 *
 * Tasks:
 * - show timers
 * - decide which view to show
 *
 * Everything is inferred from the player connection state slice
 * @param player1Id
 * @param player2Id
 * @returns
 */
export function createConnectionViewSlice(
  player1Id: string,
  player2Id: string,
): StateCreator<ConnectedViewRequirements, [], [], ConnectionViewSlice> {
  return function connectionViewSlice(originalSet, get) {
    const set = function setConnectionViewSlice(
      mutation: DeepPartial<ConnectionViewSlice["connectedView"]["mutable"]>,
    ) {
      originalSet((state) => ({
        connectedView: {
          ...state.connectedView,
          mutable: {
            player1: {
              ...state.connectedView.mutable.player1,
              ...mutation.player1,
              timer:
                mutation.player1?.timer === undefined
                  ? state.connectedView.mutable.player1.timer
                  : {
                      otherPlayerDisconnect: {
                        ...state.connectedView.mutable.player1.timer
                          .otherPlayerDisconnect,
                        ...mutation.player1.timer.otherPlayerDisconnect,
                      },
                      startTimeout: {
                        ...state.connectedView.mutable.player1.timer
                          .startTimeout,
                        ...mutation.player1.timer.startTimeout,
                      },
                    },
            },
            player2: {
              ...state.connectedView.mutable.player2,
              ...mutation.player2,
              timer:
                mutation.player2?.timer === undefined
                  ? state.connectedView.mutable.player2.timer
                  : {
                      otherPlayerDisconnect: {
                        ...state.connectedView.mutable.player2.timer
                          .otherPlayerDisconnect,
                        ...mutation.player2.timer.otherPlayerDisconnect,
                      },
                      startTimeout: {
                        ...state.connectedView.mutable.player2.timer
                          .startTimeout,
                        ...mutation.player2.timer.startTimeout,
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
            "player1" satisfies keyof ConnectedViewRequirements["connectedView"]["mutable"],
          opponent:
            "player2" satisfies keyof ConnectedViewRequirements["connectedView"]["mutable"],
        } as const;
      if (playerId === player2Id)
        return {
          currentPlayer:
            "player2" satisfies keyof ConnectedViewRequirements["connectedView"]["mutable"],
          opponent:
            "player1" satisfies keyof ConnectedViewRequirements["connectedView"]["mutable"],
        } as const;
      console.error(
        `Should be impossible, player id '${playerId}' not found. Existing player ids: '${[player1Id, player2Id].map((x) => `'${x}'`).join(", ")}'`,
      );
      // todo: find a way to kill the game in this case
      return undefined;
    };

    const constructView = (
      viewForPlayer: "player1" | "player2",
    ): DeepPartial<ConnectionPlayerView> => {
      const keys = {
        currentPlayer: viewForPlayer,
        opponent:
          viewForPlayer === "player1"
            ? ("player2" as const)
            : ("player1" as const),
      };

      const playerState = get().playerConnection.mutable[keys.currentPlayer];
      const opponentState = get().playerConnection.mutable[keys.opponent];
      const someOneDisconnected =
        playerState.disconnected || opponentState.disconnected;

      const defaultView = {
        nextActions: [],
        timer: {
          otherPlayerDisconnect: {
            visible: opponentState.disconnected,
          },
          startTimeout: {
            visible: false,
          },
        },
      } satisfies DeepPartial<ConnectionPlayerView>;

      if (someOneDisconnected && playerState.ready && opponentState.ready) {
        // game started and one player disconnected
        return {
          showView: "game-paused",
          ...defaultView,
        };
      }

      if (opponentState.disconnected) {
        return {
          showView: "waiting-for-other-player-reconnect",
          // todo: introduce visible: true for cases where the timer is paused
          ...defaultView,
        };
      }

      if (playerState.joined === false) {
        return {
          showView: "joining",
          ...defaultView,
        };
      }

      if (playerState.ready === false) {
        return {
          showView: "ready-button",
          nextActions: ["ready"],
          timer: {
            ...defaultView.timer,
            startTimeout: {
              visible: true,
            },
          },
        };
      }

      if (opponentState.joined === false) {
        return {
          showView: "waiting-for-other-player-joining",
          ...defaultView,
          timer: {
            ...defaultView.timer,
            startTimeout: {
              visible: true,
            },
          },
        };
      }

      if (opponentState.ready === false) {
        return {
          showView: "waiting-for-other-player-ready",
          ...defaultView,
          timer: {
            ...defaultView.timer,
            startTimeout: {
              visible: true,
            },
          },
        };
      }

      return {
        showView: "game",
        ...defaultView,
      };
    };

    return {
      connectedView: {
        mutable: {
          player1: {
            id: player1Id,
            nextActions: [],
            showView: "joining",
            timer: {
              otherPlayerDisconnect: {
                visible: false,
                formattedTime: "",
              },
              startTimeout: {
                visible: false,
                formattedTime: "",
              },
            },
          },
          player2: {
            id: player2Id,
            nextActions: [],
            showView: "joining",
            timer: {
              otherPlayerDisconnect: {
                visible: false,
                formattedTime: "",
              },
              startTimeout: {
                visible: false,
                formattedTime: "",
              },
            },
          },
        },
        private: {
          updateViews: () => {
            set({
              player1: constructView("player1"),
              player2: constructView("player2"),
            });
          },

          showGameEndedView: (outcome) => {
            if (outcome.result === "ongoing") return;

            const toPlayerOutcome = (yourId: string, opponentId: string) =>
              ({
                result:
                  outcome.result === "tie"
                    ? "tie"
                    : outcome.winnerId === yourId
                      ? "win"
                      : "loose",
                yourId,
                opponentId,
                reason: outcome.reason,
              }) satisfies ConnectionPlayerView["outcome"];

            set({
              player1: {
                showView: "game-ended",
                outcome: toPlayerOutcome(player1Id, player2Id),
              },
              player2: {
                showView: "game-ended",
                outcome: toPlayerOutcome(player2Id, player1Id),
              },
            });
          },

          updateStartTimeoutValue: (formattedTime) => {
            set({
              player1: {
                timer: {
                  startTimeout: {
                    formattedTime,
                  },
                },
              },
              player2: {
                timer: {
                  startTimeout: {
                    formattedTime,
                  },
                },
              },
            });
          },

          updateDisconnectedLooseValue: (formattedTime, playerId) => {
            const keys = getPlayerSpecificKeys(playerId);
            if (keys === undefined) return;

            set({
              [keys.opponent]: {
                timer: {
                  otherPlayerDisconnect: {
                    formattedTime,
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

export function registerConnectionViewSubscribers(
  store: SubscribeStore<ConnectedViewRequirements>,
) {
  const unsubscribes: (() => void)[] = [];

  unsubscribes.push(...handlePlayerJoinEvent(store));
  unsubscribes.push(...handlePlayerReadyEvent(store));
  unsubscribes.push(...handleDisconnectPlayerEvent(store));
  unsubscribes.push(...handleGameRunningEvent(store));

  unsubscribes.push(...handleStartTimeoutUpdate(store));
  unsubscribes.push(...handleDisconnectedLooseUpdate(store));

  handleGameEndedEvent(store, unsubscribes);
}

function handlePlayerJoinEvent(
  store: SubscribeStore<ConnectedViewRequirements>,
) {
  const { updateViews } = store.getState().connectedView.private;
  return [
    store.subscribe(
      (state) => state.playerConnection.mutable.player1.joined,
      () => {
        updateViews();
      },
    ),
    store.subscribe(
      (state) => state.playerConnection.mutable.player2.joined,
      () => {
        updateViews();
      },
    ),
  ];
}

function handlePlayerReadyEvent(
  store: SubscribeStore<ConnectedViewRequirements>,
) {
  const { updateViews } = store.getState().connectedView.private;
  return [
    store.subscribe(
      (state) => state.playerConnection.mutable.player1.ready,
      () => {
        updateViews();
      },
    ),
    store.subscribe(
      (state) => state.playerConnection.mutable.player2.ready,
      () => {
        updateViews();
      },
    ),
  ];
}

function handleDisconnectPlayerEvent(
  store: SubscribeStore<ConnectedViewRequirements>,
) {
  const { updateViews } = store.getState().connectedView.private;
  return [
    store.subscribe(
      (state) => state.playerConnection.mutable.player1.disconnected,
      () => {
        updateViews();
      },
    ),
    store.subscribe(
      (state) => state.playerConnection.mutable.player2.disconnected,
      () => {
        updateViews();
      },
    ),
  ];
}

function handleGameRunningEvent(
  store: SubscribeStore<ConnectedViewRequirements>,
) {
  const { updateViews } = store.getState().connectedView.private;
  return [
    store.subscribe(
      (state) => state.playerConnection.mutable.gameIsRunning,
      (gameIsRunning) => {
        if (gameIsRunning) {
          updateViews();
        }
      },
    ),
  ];
}

function handleStartTimeoutUpdate(
  store: SubscribeStore<ConnectedViewRequirements>,
) {
  const { updateStartTimeoutValue } = store.getState().connectedView.private;
  return [
    store.subscribe(
      (state) => state.timerStartTimeout.mutable.formattedTime,
      (formattedTime) => {
        updateStartTimeoutValue(formattedTime);
      },
    ),
  ];
}

function handleDisconnectedLooseUpdate(
  store: SubscribeStore<ConnectedViewRequirements>,
) {
  const { id: player1Id } = store.getState().playerConnection.mutable.player1;
  const { id: player2Id } = store.getState().playerConnection.mutable.player2;
  const { updateDisconnectedLooseValue } =
    store.getState().connectedView.private;
  return [
    store.subscribe(
      (state) => state.timerPlayer1DisconnectedLoose.mutable.formattedTime,
      (formattedTime) => {
        updateDisconnectedLooseValue(formattedTime, player1Id);
      },
    ),
    store.subscribe(
      (state) => state.timerPlayer2DisconnectedLoose.mutable.formattedTime,
      (formattedTime) => {
        updateDisconnectedLooseValue(formattedTime, player2Id);
      },
    ),
  ];
}

function handleGameEndedEvent(
  store: SubscribeStore<ConnectedViewRequirements>,
  unsubscribes: (() => void)[],
) {
  const { showGameEndedView } = store.getState().connectedView.private;
  const unSub = store.subscribe(
    (state) => state.gameResult.outcome,
    (outcome) => {
      if (outcome.result === "ongoing") return;

      showGameEndedView(outcome);
      unsubscribes.forEach((unSub) => unSub());
    },
  );
  unsubscribes.push(unSub);
}
