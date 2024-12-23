import { type StateCreator } from "zustand";
import { type PlayerConnectionSliceRequirements } from "./player-connection-state-slice";
import { type DeepPartial, type SubscribeStore } from "./zustand-helper";

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
    | "game-completed";
  timer: Record<
    VisibleTimers,
    {
      visible: boolean;
      formattedTime: string;
    }
  >;
  id: string;
}

export interface ConnectionViewSlice {
  connectedView: {
    mutable: {
      player1: PlayerView;
      player2: PlayerView;
    };
    playerJoined: (playerId: string) => void;
    playerIsReady: (playerId: string) => void;
    showGameView: () => void;
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

    const getPlayerSpecificKeys = (
      playerId: string,
      selectOpponent: boolean,
    ) => {
      if (
        (selectOpponent === false && playerId === player1Id) ||
        (selectOpponent && playerId === player2Id)
      )
        return {
          currentPlayer:
            "player1" satisfies keyof ConnectedViewRequirements["connectedView"]["mutable"],
          opponent:
            "player2" satisfies keyof ConnectedViewRequirements["connectedView"]["mutable"],
        } as const;
      if (
        (selectOpponent === false && playerId === player2Id) ||
        (selectOpponent && playerId === player1Id)
      )
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
          const keys = getPlayerSpecificKeys(playerId, false);
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
          const keys = getPlayerSpecificKeys(playerId, false);
          if (keys === undefined) return;

          const opponentView =
            get().connectedView.mutable[keys.opponent].showView;

          set({
            [keys.currentPlayer]: {
              showView:
                opponentView === "joining"
                  ? "waiting-for-other-player-joining"
                  : "waiting-for-other-player-ready",
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
      },
    };
  };
}

export function registerConnectionViewSubscribers(
  store: SubscribeStore<ConnectedViewRequirements>,
) {
  handlePlayerJoinEvent(store);
  handlePlayerReadyEvent(store);
  handleGameRunningEvent(store);
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
      if (prevPlayer1Joined) return;
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
      if (prevPlayer2Joined) return;
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
      if (prevPlayer1Ready) return;
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
      if (prevPlayer2Ready) return;
      if (player2Ready) {
        store.getState().connectedView.playerIsReady(player2Id);
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
