import { StateCreator } from "zustand";

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
      looserId: string;
      reason: "game-result" | "other-player-disconnected";
    };

export type GameResultSlice = {
  gameResult: {
    outcome: GameResult;
    neverStarted: () => void;
    forceStopGame: () => void;
    otherPlayerDisconnected: (winnerId: string, looserId: string) => void;
    gameTied: () => void;
    gameWon: (winnerId: string, looserId: string) => void;
  };
};

/**
 * This slice handles the game outcome state
 */
export function createGameResultSlice(): StateCreator<GameResultSlice> {
  return (set, get) => ({
    gameResult: {
      outcome: {
        result: "ongoing",
      },
      neverStarted: () => {
        if (get().gameResult.outcome.result !== "ongoing") return;

        set((state) => ({
          gameResult: {
            ...state.gameResult,
            outcome: {
              result: "tie",
              reason: "never-started",
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
