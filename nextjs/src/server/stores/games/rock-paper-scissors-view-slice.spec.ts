import { Temporal } from "temporal-polyfill";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createRockPaperScissorsRequirement } from "../core/creator";
import { type SubscribeStore } from "../core/zustand-helper";
import { registerRockPaperScissorsSubscribers } from "./rock-paper-scissors-slice";
import {
  createRockPaperScissorsViewSlice,
  registerRockPaperScissorsViewSubscribers,
  type RockPaperScissorsViewRequirements,
} from "./rock-paper-scissors-view-slice";

describe("rock paper scissors view slice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2023-01-01T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("before game starts", () => {
    test("by default, players see choose view", async () => {
      const { getState } = testSetup();

      expect(getState().gameView.mutable.player1.showView).toBe("choose");
      expect(getState().gameView.mutable.player2.showView).toBe("choose");
    });

    test("by default, scores are empty", async () => {
      const { getState } = testSetup();

      expect(getState().gameView.mutable.player1.score).toEqual({
        currentRound: 0,
        roundLimit: 0,
        yourScore: 0,
        opponentScore: 0,
      });
      expect(getState().gameView.mutable.player2.score).toEqual({
        currentRound: 0,
        roundLimit: 0,
        yourScore: 0,
        opponentScore: 0,
      });
    });
  });

  describe("round 1", () => {
    test("should provide the correct roundLimit and currentRound numbers", async () => {
      const { getState, startGame } = testSetup({ roundsLimit: 3 });

      startGame();

      expect(getState().gameView.mutable.player1.score).toEqual({
        currentRound: 1,
        roundLimit: 3,
        yourScore: 0,
        opponentScore: 0,
      });
      expect(getState().gameView.mutable.player2.score).toEqual({
        currentRound: 1,
        roundLimit: 3,
        yourScore: 0,
        opponentScore: 0,
      });
    });
  });
});

function testSetup({
  roundsNeededToWin,
  roundsLimit,
  durations,
}: {
  roundsNeededToWin?: number;
  roundsLimit?: number;
  durations?: {
    chooseTimeout?: Temporal.Duration;
    showCurrentScore?: Temporal.Duration;
  };
} = {}) {
  const player1Id = "player1";
  const player2Id = "player2";
  const usedDurations = {
    chooseTimeout: Temporal.Duration.from({ seconds: 10 }),
    showCurrentScore: Temporal.Duration.from({ seconds: 10 }),
    ...durations,
  };
  const store = createStore<RockPaperScissorsViewRequirements>()(
    subscribeWithSelector((...a) => ({
      ...createRockPaperScissorsViewSlice(player1Id, player2Id)(...a),
      ...createRockPaperScissorsRequirement(
        player1Id,
        player2Id,
        {
          forceStop: Temporal.Duration.from({ seconds: 120 }),
          disconnectLoose: Temporal.Duration.from({ seconds: 10 }),
          startTimeout: Temporal.Duration.from({ seconds: 10 }),
        },
        {
          durations: usedDurations,
          roundsNeededToWin: roundsNeededToWin ?? 3,
          roundsLimit: roundsLimit ?? 10,
        },
      )(...a),
    })),
  );

  const subStore = store as SubscribeStore<RockPaperScissorsViewRequirements>;
  registerRockPaperScissorsSubscribers(subStore);
  registerRockPaperScissorsViewSubscribers(subStore);

  const getState = () => {
    return store.getState();
  };
  const { connectPlayer, markReady, disconnectPlayer } =
    getState().playerConnection;

  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { chooseItem } = getState().gameLogic;

  return {
    getState,
    player1Id,
    player2Id,
    chooseItem,
    startGame: () => {
      connectPlayer(player1Id);
      connectPlayer(player2Id);
      markReady(player1Id);
      markReady(player2Id);
    },
    letPlayerWinRound: async (playerId: string) => {
      const opponent = playerId === player1Id ? player2Id : player1Id;
      chooseItem(playerId, "rock");
      chooseItem(opponent, "scissors");
      await vi.advanceTimersByTimeAsync(
        usedDurations.showCurrentScore.total({ unit: "milliseconds" }),
      );
    },
    letPlayersTieRound: async () => {
      chooseItem(player1Id, "rock");
      chooseItem(player2Id, "rock");
      await vi.advanceTimersByTimeAsync(
        usedDurations.showCurrentScore.total({ unit: "milliseconds" }),
      );
    },
    connectPlayer,
    disconnectPlayer,
    durations: usedDurations,
  };
}
