import { create, StoreApi, StateCreator } from "zustand";
import { AnyGame } from "./known-games";
import { Temporal } from "temporal-polyfill";
import { Timer } from "./timer";

interface PlayerState {
  joined: boolean;
  ready: boolean;
  disconnected: boolean;
  id: string;
}

interface ConnectionView {
  showView: "ready-button" | "game" | "game-paused" | "game-completed";
  playerId: string;
  visibleTimer: ("start-timeout" | "other-player-disconnected")[];
  actions: "ready"[];
}

interface ConnectionState {
  player1: PlayerState;
  player2: PlayerState;
  game: AnyGame;

  // #region computed

  gameIsRunning: boolean;

  // #endregion

  // #region actions

  connectPlayer: (playerId: string) => string | undefined;
  disconnectPlayer: (playerId: string) => void;
  markReady: (playerId: string) => string | undefined;

  // #endregion

  internal: {
    gameCompleted: boolean;
    timers: {
      startTimeout: Timer;
      player1DisconnectedLoose: Timer;
      player2DisconnectedLoose: Timer;
      forceStopGame: Timer;
    };
    /**
     * only to be called when the game is over
     */
    cleanup: () => void;
  };
}

type GameResult =
  | {
      result: "ongoing";
    }
  | {
      result: "tie";
      reason: "game-result" | "never-started" | "force-stop-game";
    }
  | {
      result: "winner";
      winnerId: string;
      reason: "game-result" | "other-player-disconnected";
    };

/**
 * Wrap a game with the necessary state to manage player connections
 *
 * @param game
 * @param player1Id
 * @param player2Id
 * @param timeOptions
 * @param onGameComplete Called when the game is over and the stores can be cleaned up
 * @returns
 */
export function createGameConnectionStoreWrapper(
  game: AnyGame,
  player1Id: string,
  player2Id: string,
  timeOptions: {
    startTimeout: Temporal.Duration;
    disconnectTimeout: Temporal.Duration;
    forceStopGame: Temporal.Duration;
  },
  onGameComplete: (outcome: GameResult) => void,
): StoreApi<ConnectionState> {
  // todo: pass a onComplete function to the game, which should be invoked when the game is over normally

  return create<ConnectionState>((set, get) => ({
    player1: {
      joined: false,
      ready: false,
      disconnected: false,
      id: player1Id,
    },
    player2: {
      joined: false,
      ready: false,
      disconnected: false,
      id: player2Id,
    },
    game,
    get gameIsRunning() {
      const state = get();
      return (
        state.player1.joined &&
        state.player2.joined &&
        state.player1.ready &&
        state.player2.ready &&
        !state.player1.disconnected &&
        !state.player2.disconnected
      );
    },
    connectPlayer: (playerId) => {
      if (get().internal.gameCompleted) return "game already completed";
      if (get().gameIsRunning) return "game already running";

      // manage timers
      get().internal.timers.startTimeout.startOrResume();
      const disconnectTimerKey =
        playerId === get().player1.id
          ? "player1DisconnectedLoose"
          : "player2DisconnectedLoose";
      get().internal.timers[disconnectTimerKey].pause();

      //   update state
      set((state) => {
        const playerKey = state.player1.id === playerId ? "player1" : "player2";
        return {
          ...state,
          [playerKey]: {
            ...state[playerKey],
            joined: true,
            disconnected: false,
          },
        };
      });
      return undefined;
    },
    disconnectPlayer: (playerId) => {
      if (get().internal.gameCompleted) return "game already completed";

      // manage timers
      const disconnectTimerKey =
        playerId === get().player1.id
          ? "player1DisconnectedLoose"
          : "player2DisconnectedLoose";
      get().internal.timers[disconnectTimerKey].startOrResume();

      // update state
      set((state) => {
        const playerKey = state.player1.id === playerId ? "player1" : "player2";
        const newState = {
          ...state,
          [playerKey]: {
            ...state[playerKey],
            disconnected: true,
            ready: false,
          },
        };

        // If either player disconnects, pause the game
        if (newState.player1.disconnected || newState.player2.disconnected) {
          get().game.getState().pauseGame();
        }

        return newState;
      });
    },
    markReady: (playerId) => {
      if (get().internal.gameCompleted) return "game already completed";
      if (get().gameIsRunning) return "player already ready";
      const playerKey = get().player1.id === playerId ? "player1" : "player2";

      if (get()[playerKey].ready) return "player already ready";

      set((state) => {
        const newState = {
          ...state,
          [playerKey]: {
            ...state[playerKey],
            ready: true,
          },
        };

        // Check if both players are joined, ready, and connected, then start the game
        if (
          newState.player1.joined &&
          newState.player2.joined &&
          !newState.player1.disconnected &&
          !newState.player2.disconnected &&
          newState.player1.ready &&
          newState.player2.ready
        ) {
          get().internal.timers.startTimeout.cancel();
          get().game.getState().startOrResumeGame();
        }

        return newState;
      });
      return undefined;
    },
    internal: {
      gameCompleted: false,
      timers: {
        startTimeout: new Timer(timeOptions.startTimeout, () => {
          if (get().internal.gameCompleted) return;

          // if only one of the players managed to connect, then the other player is the winner
          if (get().player1.joined && get().player2.joined === false) {
            onGameComplete({
              result: "winner",
              winnerId: get().player1.id,
              reason: "game-result",
            });
          }
          if (get().player1.joined === false && get().player2.joined) {
            onGameComplete({
              result: "winner",
              winnerId: get().player2.id,
              reason: "game-result",
            });
          }

          //   if only one of the player managed to select ready, then the other player is the winner
          if (get().player1.ready && get().player2.ready === false) {
            onGameComplete({
              result: "winner",
              winnerId: get().player1.id,
              reason: "game-result",
            });
          }
          if (get().player1.ready === false && get().player2.ready) {
            onGameComplete({
              result: "winner",
              winnerId: get().player2.id,
              reason: "game-result",
            });
          }

          //   both player did not join and did not select ready, then the game is a tie
          onGameComplete({
            result: "tie",
            reason: "never-started",
          });

          set((state) => ({
            internal: { ...state.internal, gameCompleted: true },
          }));
          get().internal.cleanup();
        }),
        player1DisconnectedLoose: new Timer(
          timeOptions.disconnectTimeout,
          () => {
            if (get().internal.gameCompleted) return;
            onGameComplete({
              result: "winner",
              winnerId: get().player2.id,
              reason: "other-player-disconnected",
            });

            set((state) => ({
              internal: { ...state.internal, gameCompleted: true },
            }));
            get().internal.cleanup();
          },
        ),
        player2DisconnectedLoose: new Timer(
          timeOptions.disconnectTimeout,
          () => {
            if (get().internal.gameCompleted) return;
            onGameComplete({
              result: "winner",
              winnerId: get().player1.id,
              reason: "other-player-disconnected",
            });

            set((state) => ({
              internal: { ...state.internal, gameCompleted: true },
            }));
            get().internal.cleanup();
          },
        ),
        forceStopGame: new Timer(timeOptions.forceStopGame, () => {
          if (get().internal.gameCompleted) return;
          onGameComplete({
            result: "tie",
            reason: "force-stop-game",
          });

          set((state) => ({
            internal: { ...state.internal, gameCompleted: true },
          }));
          get().internal.cleanup();
        }),
      },
      cleanup: () => {
        get().internal.timers.startTimeout.cancel();
        get().internal.timers.player1DisconnectedLoose.cancel();
        get().internal.timers.player2DisconnectedLoose.cancel();
        get().internal.timers.forceStopGame.cancel();
      },
    },
  }));
}
