import { type StateCreator } from "zustand";

// #region types

type GameResult =
  | {
      result: "ongoing";
      reason: undefined;
      winnerId: undefined;
      looserId: undefined;
    }
  | {
      result: "tie";
      reason: "game-result" | "never-started" | "force-stop-game";
      winnerId: undefined;
      looserId: undefined;
    }
  | {
      result: "winner";
      reason: "game-result" | "other-player-disconnected" | "never-started";
      winnerId: string;
      looserId: string;
    };

export type GameResultSlice = {
  gameResult: {
    outcome: GameResult;
    neverStarted: (optionalResult?: {
      winnerId: string;
      looserId: string;
    }) => void;
    forceStopGame: () => void;
    otherPlayerDisconnected: (winnerId: string, looserId: string) => void;
    gameTied: () => void;
    gameWon: (winnerId: string, looserId: string) => void;
  };
};

// #endregion

/**
 * This slice handles the game outcome state.
 * Once the outcome is decided, it can't be changed anymore.
 */
export function createGameResultSlice(): StateCreator<GameResultSlice> {
  return (set, get) => ({
    gameResult: {
      outcome: {
        result: "ongoing",
        reason: undefined,
        looserId: undefined,
        winnerId: undefined,
      },
      neverStarted: (optionalResult) => {
        if (get().gameResult.outcome.result !== "ongoing") return;

        if (optionalResult !== undefined) {
          set((state) => ({
            gameResult: {
              ...state.gameResult,
              outcome: {
                result: "winner",
                winnerId: optionalResult.winnerId,
                looserId: optionalResult.looserId,
                reason: "never-started",
              },
            },
          }));
          return;
        }

        set((state) => ({
          gameResult: {
            ...state.gameResult,
            outcome: {
              result: "tie",
              reason: "never-started",
              winnerId: undefined,
              looserId: undefined,
            },
          },
        }));
      },
      forceStopGame: () => {
        if (get().gameResult.outcome.result !== "ongoing") return;

        set((state) => ({
          gameResult: {
            ...state.gameResult,
            outcome: {
              result: "tie",
              reason: "force-stop-game",
              winnerId: undefined,
              looserId: undefined,
            },
          },
        }));
      },
      otherPlayerDisconnected: (winnerId, looserId) => {
        if (get().gameResult.outcome.result !== "ongoing") return;

        set((state) => ({
          gameResult: {
            ...state.gameResult,
            outcome: {
              result: "winner",
              winnerId,
              looserId,
              reason: "other-player-disconnected",
            },
          },
        }));
      },
      gameTied: () => {
        if (get().gameResult.outcome.result !== "ongoing") return;

        set((state) => ({
          gameResult: {
            ...state.gameResult,
            outcome: {
              result: "tie",
              reason: "game-result",
              winnerId: undefined,
              looserId: undefined,
            },
          },
        }));
      },
      gameWon: (winnerId, looserId) => {
        if (get().gameResult.outcome.result !== "ongoing") return;

        set((state) => ({
          gameResult: {
            ...state.gameResult,
            outcome: {
              result: "winner",
              winnerId,
              looserId,
              reason: "game-result",
            },
          },
        }));
      },
    },
  });
}
