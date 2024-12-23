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
  result: {
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
    result: {
      outcome: {
        result: "ongoing",
      },
      neverStarted: () => {
        if (get().result.outcome.result !== "ongoing") return;

        set((state) => ({
          result: {
            ...state.result,
            outcome: {
              result: "tie",
              reason: "never-started",
            },
          },
        }));
      },
      forceStopGame: () => {
        if (get().result.outcome.result !== "ongoing") return;

        set((state) => ({
          result: {
            ...state.result,
            outcome: {
              result: "tie",
              reason: "force-stop-game",
            },
          },
        }));
      },
      otherPlayerDisconnected: (winnerId, looserId) => {
        if (get().result.outcome.result !== "ongoing") return;

        set((state) => ({
          result: {
            ...state.result,
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
        if (get().result.outcome.result !== "ongoing") return;

        set((state) => ({
          result: {
            ...state.result,
            outcome: {
              result: "tie",
              reason: "game-result",
            },
          },
        }));
      },
      gameWon: (winnerId, looserId) => {
        if (get().result.outcome.result !== "ongoing") return;

        set((state) => ({
          result: {
            ...state.result,
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
