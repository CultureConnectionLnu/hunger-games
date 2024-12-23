import { type StateCreator } from "zustand";
import { type PlayerConnectionSliceRequirements } from "./player-connection-state-slice";
import { type DeepPartial, type SubscribeStore } from "./zustand-helper";

type VisibleTimers = "startTimeout" | "otherPlayerDisconnect";

interface PlayerView {
  nextActions: "ready"[];
  showView:
    | "joining"
    | "ready-button"
    | "waiting-for-other-player-joining"
    | "waiting-for-other-player-ready"
    | "game"
    | "game-paused"
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
    showReadyButton: (playerId: string) => void;
    showWaitingForOtherPlayerJoining: (
      playerId: string,
      selectOpponent?: boolean,
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

    const getPlayerSpecificKeys = (
      playerId: string,
      selectOpponent: boolean,
    ) => {
      if (
        (selectOpponent === false && playerId === player1Id) ||
        (selectOpponent && playerId === player2Id)
      )
        return {
          playerKey:
            "player1" satisfies keyof ConnectedViewRequirements["connectedView"]["mutable"],
        } as const;
      if (
        (selectOpponent === false && playerId === player2Id) ||
        (selectOpponent && playerId === player1Id)
      )
        return {
          playerKey:
            "player2" satisfies keyof ConnectedViewRequirements["connectedView"]["mutable"],
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
        showReadyButton: (playerId) => {
          const keys = getPlayerSpecificKeys(playerId, false);
          if (keys === undefined) return;

          if (
            get().connectedView.mutable[keys.playerKey].showView !== "joining"
          )
            return;

          set({
            [keys.playerKey]: {
              showView: "ready-button",
              nextActions: ["ready"],
              timer: {
                startTimeout: {
                  visible: true,
                },
              },
            } satisfies DeepPartial<PlayerView>,
          });
        },
        showWaitingForOtherPlayerJoining: (
          playerId,
          selectOpponent = false,
        ) => {
          const keys = getPlayerSpecificKeys(playerId, selectOpponent);
          if (keys === undefined) return;

          const currentView =
            get().connectedView.mutable[keys.playerKey].showView;
          if (currentView === "waiting-for-other-player-joining") return;

          set({
            [keys.playerKey]: {
              showView: "waiting-for-other-player-joining",
              nextActions: [],
            } satisfies DeepPartial<PlayerView>,
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
        store.getState().connectedView.showReadyButton(player1Id);
        // store
        //   .getState()
        //   .connectedView.showWaitingForOtherPlayerJoining(player1Id, true);
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
        store.getState().connectedView.showReadyButton(player2Id);
        // store
        //   .getState()
        //   .connectedView.showWaitingForOtherPlayerJoining(player2Id, true);
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
        store
          .getState()
          .connectedView.showWaitingForOtherPlayerJoining(player1Id);
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
        store
          .getState()
          .connectedView.showWaitingForOtherPlayerJoining(player2Id);
      }
    },
  );
}
