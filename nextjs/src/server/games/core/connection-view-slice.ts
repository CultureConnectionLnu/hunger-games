import { type StateCreator } from "zustand";
import { type PlayerConnectionSliceRequirements } from "./player-connection-state-slice";
import { type DeepPartial, type SubscribeStore } from "./zustand-helper";
import { type GameResultSlice } from "./game-result-slice";

type VisibleTimers = "startTimeout" | "otherPlayerDisconnect";

interface PlayerView {
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
      player1: PlayerView;
      player2: PlayerView;
    };
    playerJoined: (playerId: string) => void;
    playerIsReady: (playerId: string) => void;
    playerDisconnected: (playerId: string) => void;
    playerConnected: (playerId: string) => void;
    showGameView: () => void;
    showPausedView: () => void;
    showGameEndedView: (
      outcome: GameResultSlice["gameResult"]["outcome"],
    ) => void;
  };
}

export type ConnectedViewRequirements = PlayerConnectionSliceRequirements &
  ConnectionViewSlice;

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
                        ...state.connectedView.mutable.player1.timer
                          .otherPlayerDisconnect,
                        ...mutation.player2.timer.otherPlayerDisconnect,
                      },
                      startTimeout: {
                        ...state.connectedView.mutable.player1.timer
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
        playerJoined: (playerId) => {
          const keys = getPlayerSpecificKeys(playerId);
          if (keys === undefined) return;

          if (
            get().connectedView.mutable[keys.currentPlayer].showView !==
            "joining"
          )
            return;

          set({
            [keys.currentPlayer]: {
              showView: "ready-button",
              nextActions: ["ready"],
              timer: {
                startTimeout: {
                  visible: true,
                },
              },
            } satisfies DeepPartial<PlayerView>,
          });

          const opponentView =
            get().connectedView.mutable[keys.opponent].showView;
          if (opponentView === "waiting-for-other-player-joining") {
            set({
              [keys.opponent]: {
                showView: "waiting-for-other-player-ready",
              },
            });
          }
        },

        playerIsReady: (playerId) => {
          const keys = getPlayerSpecificKeys(playerId);
          if (keys === undefined) return;

          const opponentDisconnected =
            get().playerConnection.mutable[keys.opponent].disconnected;
          const opponentView =
            get().connectedView.mutable[keys.opponent].showView;

          set({
            [keys.currentPlayer]: {
              showView: opponentDisconnected
                ? "waiting-for-other-player-reconnect"
                : opponentView === "joining"
                  ? "waiting-for-other-player-joining"
                  : "waiting-for-other-player-ready",
              nextActions: [],
            } satisfies DeepPartial<PlayerView>,
          });
        },

        playerDisconnected: (playerId) => {
          const currentView = get().connectedView.mutable.player1.showView;
          // always both players are in the game.
          // so checking any player if the current view is `game` is sufficient
          if (currentView === "game") {
            get().connectedView.showPausedView();
            return;
          }
          if (currentView === "game-paused") {
            return;
          }

          const keys = getPlayerSpecificKeys(playerId);
          if (keys === undefined) return;

          set({
            [keys.opponent]: {
              showView: "waiting-for-other-player-reconnect",
              nextActions: [],
            } satisfies DeepPartial<PlayerView>,
          });
        },

        playerConnected: (playerId) => {
          const currentView = get().connectedView.mutable.player1.showView;
          // always both players are in the game.
          // so checking any player if the current view is `game` is sufficient
          if (currentView === "game-paused") {
            return;
          }

          const keys = getPlayerSpecificKeys(playerId);
          if (keys === undefined) return;

          set({
            [keys.opponent]: {
              showView: "waiting-for-other-player-ready",
              nextActions: [],
            } satisfies DeepPartial<PlayerView>,
          });
        },

        showGameView: () => {
          // todo: are restrictions needed?
          set({
            player1: {
              showView: "game",
            },
            player2: {
              showView: "game",
            },
          });
        },

        showPausedView: () => {
          // todo: are restrictions needed?
          set({
            player1: {
              showView: "game-paused",
            },
            player2: {
              showView: "game-paused",
            },
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
            }) satisfies PlayerView["outcome"];

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
      },
    };
  };
}

export function registerConnectionViewSubscribers(
  store: SubscribeStore<ConnectedViewRequirements>,
) {
  handlePlayerJoinEvent(store);
  handlePlayerReadyEvent(store);
  handleDisconnectPlayerEvent(store);
  handleGameRunningEvent(store);
  handleGameEnded(store);
}

function handlePlayerJoinEvent(
  store: SubscribeStore<ConnectedViewRequirements>,
) {
  store.subscribe(
    (state) =>
      [
        state.playerConnection.mutable.player1.joined,
        state.playerConnection.mutable.player1.id,
      ] as const,
    ([player1Joined, player1Id], [prevPlayer1Joined]) => {
      if (player1Joined === prevPlayer1Joined) return;
      if (player1Joined) {
        store.getState().connectedView.playerJoined(player1Id);
      }
    },
  );
  store.subscribe(
    (state) =>
      [
        state.playerConnection.mutable.player2.joined,
        state.playerConnection.mutable.player2.id,
      ] as const,
    ([player2Joined, player2Id], [prevPlayer2Joined]) => {
      if (player2Joined === prevPlayer2Joined) return;
      if (player2Joined) {
        store.getState().connectedView.playerJoined(player2Id);
      }
    },
  );
}

function handlePlayerReadyEvent(
  store: SubscribeStore<ConnectedViewRequirements>,
) {
  store.subscribe(
    (state) =>
      [
        state.playerConnection.mutable.player1.ready,
        state.playerConnection.mutable.player1.id,
      ] as const,
    ([player1Ready, player1Id], [prevPlayer1Ready]) => {
      if (player1Ready === prevPlayer1Ready) return;
      if (player1Ready) {
        store.getState().connectedView.playerIsReady(player1Id);
      }
    },
  );
  store.subscribe(
    (state) =>
      [
        state.playerConnection.mutable.player2.ready,
        state.playerConnection.mutable.player2.id,
      ] as const,
    ([player2Ready, player2Id], [prevPlayer2Ready]) => {
      if (player2Ready === prevPlayer2Ready) return;
      if (player2Ready) {
        store.getState().connectedView.playerIsReady(player2Id);
      }
    },
  );
}

function handleDisconnectPlayerEvent(
  store: SubscribeStore<ConnectedViewRequirements>,
) {
  store.subscribe(
    (state) =>
      [
        state.playerConnection.mutable.player1.disconnected,
        state.playerConnection.mutable.player1.id,
      ] as const,
    ([disconnected, player1Id], [prevDisconnected]) => {
      if (disconnected === prevDisconnected) return;
      if (disconnected) {
        store.getState().connectedView.playerDisconnected(player1Id);
      } else {
        store.getState().connectedView.playerConnected(player1Id);
      }
    },
  );
  store.subscribe(
    (state) =>
      [
        state.playerConnection.mutable.player2.disconnected,
        state.playerConnection.mutable.player2.id,
      ] as const,
    ([disconnected, player2Id], [prevDisconnected]) => {
      if (disconnected === prevDisconnected) return;
      if (disconnected) {
        store.getState().connectedView.playerDisconnected(player2Id);
      } else {
        store.getState().connectedView.playerConnected(player2Id);
      }
    },
  );
}

function handleGameRunningEvent(
  store: SubscribeStore<ConnectedViewRequirements>,
) {
  store.subscribe(
    (state) => state.playerConnection.mutable.gameIsRunning,
    (gameIsRunning) => {
      if (gameIsRunning) {
        store.getState().connectedView.showGameView();
      }
    },
  );
}

function handleGameEnded(store: SubscribeStore<ConnectedViewRequirements>) {
  store.subscribe(
    (state) => state.gameResult.outcome,
    (outcome) => {
      store.getState().connectedView.showGameEndedView(outcome);
    },
  );
}
