import { StateCreator } from "zustand";
import { GameResultSlice } from "./game-result-slice";
import { KnownTimerNames, TimerSlice } from "./timer-slice";

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
    };
    gameIsRunning: boolean;

    connectPlayer: (playerId: string) => string | undefined;
    disconnectPlayer: (playerId: string) => void;
    markReady: (playerId: string) => string | undefined;
  };
}

export function createPlayerConnectionSlice(
  player1Id: string,
  player2Id: string,
): StateCreator<
  PlayerConnectionSlice &
    GameResultSlice &
    TimerSlice<
      | "timerForceStopGame"
      | "timerStartTimeout"
      | "timerPlayer1DisconnectedLoose"
      | "timerPlayer2DisconnectedLoose"
    >,
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
        },

        get gameIsRunning() {
          const { player1, player2 } = get().playerConnection.mutable;
          return (
            player1.joined &&
            player2.joined &&
            player1.ready &&
            player2.ready &&
            player1.disconnected === false &&
            player2.disconnected === false
          );
        },

        connectPlayer: (playerId) => {
          if (get().gameResult.outcome.result !== "ongoing")
            return "game already completed";
          if (get().playerConnection.gameIsRunning)
            return "game already running";

          const keys = getPlayerSpecificKeys(playerId);
          if (keys === undefined) return "invalid player id";
          const { disconnectTimerKey, playerKey } = keys;

          get().timerStartTimeout.startOrResume();
          get()[disconnectTimerKey].pause();

          set({
            [playerKey]: {
              joined: true,
              disconnected: false,
            } satisfies Partial<PlayerState>,
          });

          if (get().playerConnection.gameIsRunning === false) return;
          // should start game again upon all players are connected again
          // todo: start game
        },

        disconnectPlayer: (playerId) => {
          if (get().gameResult.outcome.result !== "ongoing")
            return "game already completed";

          const keys = getPlayerSpecificKeys(playerId);
          if (keys === undefined) return "invalid player id";
          const { disconnectTimerKey, playerKey } = keys;
          get()[disconnectTimerKey].startOrResume();

          set({
            [playerKey]: {
              disconnected: true,
            } satisfies Partial<PlayerState>,
          });

          // todo: pause game
        },

        markReady: (playerId) => {
          if (get().gameResult.outcome.result !== "ongoing")
            return "game already completed";
          if (get().playerConnection.gameIsRunning)
            return "game already running";

          const keys = getPlayerSpecificKeys(playerId);
          if (keys === undefined) return "invalid player id";
          const { playerKey } = keys;

          if (get().playerConnection.mutable[playerKey].ready)
            return "player already ready";

          set({
            [playerKey]: {
              ready: true,
            } satisfies Partial<PlayerState>,
          });

          if (get().playerConnection.gameIsRunning === false) return;

          get().timerStartTimeout.cancel();
          // todo: start game
        },
      },
    };
  };
}

export function registerSubscribers() {}
