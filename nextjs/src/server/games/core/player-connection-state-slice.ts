import { StateCreator, Mutate, UseBoundStore, StoreApi } from "zustand";
import { GameResultSlice } from "./game-result-slice";
import { KnownTimerNames, TimerSlice } from "./timer-slice";
import { SubscribeStore } from "./zustand-helper";

declare global {
  interface KnownTimerNamesMap {
    timerStartTimeout: string;
    timerPlayer1DisconnectedLoose: string;
    timerPlayer2DisconnectedLoose: string;
    timerForceStopGame: string;
  }
}

interface PlayerState {
  joined: boolean;
  ready: boolean;
  disconnected: boolean;
  id: string;
}

type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
} & {};

export interface PlayerConnectionSlice {
  playerConnection: {
    mutable: {
      player1: PlayerState;
      player2: PlayerState;
      gameIsRunning: boolean;
    };

    connectPlayer: (playerId: string) => string | undefined;
    disconnectPlayer: (playerId: string) => void;
    markReady: (playerId: string) => string | undefined;
  };
}

export type PlayerConnectionSliceRequirements = PlayerConnectionSlice &
  GameResultSlice &
  TimerSlice<
    | "timerForceStopGame"
    | "timerStartTimeout"
    | "timerPlayer1DisconnectedLoose"
    | "timerPlayer2DisconnectedLoose"
  >;

export function createPlayerConnectionSlice(
  player1Id: string,
  player2Id: string,
): StateCreator<
  PlayerConnectionSliceRequirements,
  [],
  [],
  PlayerConnectionSlice
> {
  return function playerConnectionSlice(originalSet, get) {
    const set = function setPlayerConnectionSlice(
      mutation: DeepPartial<
        PlayerConnectionSlice["playerConnection"]["mutable"]
      > & {},
    ) {
      originalSet((state) => ({
        playerConnection: {
          ...state.playerConnection,
          mutable: {
            ...state.playerConnection.mutable,
            ...mutation,
            player1: {
              ...state.playerConnection.mutable.player1,
              ...mutation.player1,
            },
            player2: {
              ...state.playerConnection.mutable.player2,
              ...mutation.player2,
            },
          },
        },
      }));
    };

    const getPlayerSpecificKeys = (playerId: string) => {
      if (playerId === player1Id)
        return {
          disconnectTimerKey:
            "timerPlayer1DisconnectedLoose" satisfies KnownTimerNames,
          playerKey:
            "player1" satisfies keyof PlayerConnectionSlice["playerConnection"]["mutable"],
        } as const;
      if (playerId === player2Id)
        return {
          disconnectTimerKey:
            "timerPlayer2DisconnectedLoose" satisfies KnownTimerNames,
          playerKey:
            "player2" satisfies keyof PlayerConnectionSlice["playerConnection"]["mutable"],
        } as const;
      return undefined;
    };

    const getGameIsRunning = () => {
      const { player1, player2 } = get().playerConnection.mutable;
      return (
        player1.joined &&
        player2.joined &&
        player1.ready &&
        player2.ready &&
        player1.disconnected === false &&
        player2.disconnected === false
      );
    };

    return {
      playerConnection: {
        mutable: {
          player1: {
            id: player1Id,
            joined: false,
            ready: false,
            disconnected: false,
          },
          player2: {
            id: player2Id,
            joined: false,
            ready: false,
            disconnected: false,
          },
          gameIsRunning: false,
        },

        connectPlayer: (playerId) => {
          if (get().gameResult.outcome.result !== "ongoing")
            return "game already completed";
          if (get().playerConnection.mutable.gameIsRunning)
            return "game already running";

          const keys = getPlayerSpecificKeys(playerId);
          if (keys === undefined) return "invalid player id";
          const { disconnectTimerKey, playerKey } = keys;

          get().timerStartTimeout.startOrResume();
          get()[disconnectTimerKey].pause();

          if (
            get().playerConnection.mutable[playerKey].joined &&
            get().playerConnection.mutable[playerKey].disconnected === false
          )
            return "player already joined";

          set({
            [playerKey]: {
              joined: true,
              disconnected: false,
            } satisfies Partial<PlayerState>,
          });

          const isGameRunning = getGameIsRunning();
          if (get().playerConnection.mutable.gameIsRunning !== isGameRunning) {
            set({ gameIsRunning: isGameRunning });
          }

          if (isGameRunning === false) {
            return;
          }
          // should start game again upon all players are connected again
          // todo: start game
        },

        disconnectPlayer: (playerId) => {
          if (get().gameResult.outcome.result !== "ongoing")
            return "game already completed";

          const keys = getPlayerSpecificKeys(playerId);
          if (keys === undefined) return "invalid player id";
          const { disconnectTimerKey, playerKey } = keys;

          if (get().playerConnection.mutable[playerKey].joined === false)
            return "player never joined";

          get()[disconnectTimerKey].startOrResume();

          set({
            [playerKey]: {
              disconnected: true,
            } satisfies Partial<PlayerState>,
          });

          const isGameRunning = getGameIsRunning();
          if (get().playerConnection.mutable.gameIsRunning !== isGameRunning) {
            set({ gameIsRunning: isGameRunning });
          }

          // todo: pause game
        },

        markReady: (playerId) => {
          if (get().gameResult.outcome.result !== "ongoing")
            return "game already completed";
          if (get().playerConnection.mutable.gameIsRunning)
            return "game already running";

          const keys = getPlayerSpecificKeys(playerId);
          if (keys === undefined) return "invalid player id";
          const { playerKey } = keys;

          if (get().playerConnection.mutable[playerKey].joined === false)
            return "player not joined";
          if (get().playerConnection.mutable[playerKey].ready)
            return "player already ready";

          set({
            [playerKey]: {
              ready: true,
            } satisfies Partial<PlayerState>,
          });

          const isGameRunning = getGameIsRunning();
          if (get().playerConnection.mutable.gameIsRunning !== isGameRunning) {
            set({ gameIsRunning: isGameRunning });
          }

          if (isGameRunning === false) return;

          get().timerStartTimeout.cancel();
          // todo: start game
        },
      },
    };
  };
}

export function registerPlayerConnectionSubscribers(
  store: SubscribeStore<PlayerConnectionSliceRequirements>,
) {
  // start the force stop timer
  store.getState().timerForceStopGame.startOrResume();

  // handle timer complete events
  handleForceGameEnd(store);
  handlePlayer1DisconnectedLoose(store);
  handlePlayer2DisconnectedLoose(store);
  handleStartTimeout(store);

  cleanupUponGameCompleted(store);
}

function handleForceGameEnd(
  store: SubscribeStore<PlayerConnectionSliceRequirements>,
) {
  store.subscribe(
    (state) => state.timerForceStopGame.mutable.completed,
    (completed) => {
      if (completed === false) return;

      const { canceled } = store.getState().timerForceStopGame.mutable;
      if (canceled) return;

      store.getState().gameResult.forceStopGame();
    },
  );
}

function handlePlayer1DisconnectedLoose(
  store: SubscribeStore<PlayerConnectionSliceRequirements>,
) {
  store.subscribe(
    (state) => state.timerPlayer1DisconnectedLoose.mutable.completed,
    (completed) => {
      if (completed === false) return;

      const { canceled } =
        store.getState().timerPlayer1DisconnectedLoose.mutable;
      if (canceled) return;

      store.getState().gameResult.otherPlayerDisconnected("player2", "player1");
    },
  );
}

function handlePlayer2DisconnectedLoose(
  store: SubscribeStore<PlayerConnectionSliceRequirements>,
) {
  store.subscribe(
    (state) => state.timerPlayer2DisconnectedLoose.mutable.completed,
    (completed) => {
      if (completed === false) return;

      const { canceled } =
        store.getState().timerPlayer2DisconnectedLoose.mutable;
      if (canceled) return;

      store.getState().gameResult.otherPlayerDisconnected("player1", "player2");
    },
  );
}

function handleStartTimeout(
  store: SubscribeStore<PlayerConnectionSliceRequirements>,
) {
  store.subscribe(
    (state) => state.timerStartTimeout.mutable.completed,
    (completed) => {
      if (completed === false) return;

      const { canceled } = store.getState().timerStartTimeout.mutable;
      if (canceled) return;

      const { neverStarted } = store.getState().gameResult;
      const { player1, player2 } = store.getState().playerConnection.mutable;
      if (player1.joined && player2.joined === false) {
        neverStarted({ winnerId: player1.id, looserId: player2.id });
      } else if (player1.joined === false && player2.joined) {
        neverStarted({ winnerId: player2.id, looserId: player1.id });
      } else if (player1.ready && player2.ready === false) {
        neverStarted({ winnerId: player1.id, looserId: player2.id });
      } else if (player1.ready === false && player2.ready) {
        neverStarted({ winnerId: player2.id, looserId: player1.id });
      }

      // can't decide upon a winner, because both players are in the same state
      neverStarted();
    },
  );
}

function cleanupUponGameCompleted(
  store: SubscribeStore<PlayerConnectionSliceRequirements>,
) {
  store.subscribe(
    (state) => state.gameResult.outcome.result,
    (result) => {
      if (result === "ongoing") return;

      store.getState().timerStartTimeout.cancel();
      store.getState().timerPlayer1DisconnectedLoose.cancel();
      store.getState().timerPlayer2DisconnectedLoose.cancel();
      store.getState().timerForceStopGame.cancel();
    },
  );
}
