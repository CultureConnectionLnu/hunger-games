import { Temporal } from "temporal-polyfill";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createPlayerConnectionRequirement } from "../core/creator";
import { createTimerSlice } from "../core/timer-slice";
import { type SubscribeStore } from "../core/zustand-helper";
import {
  createRockPaperScissorsSlice,
  registerRockPaperScissorsSubscribers,
  type RockPaperScissorsItem,
  type RockPaperScissorsSlice,
  type RockPaperScissorsRequirements,
  type RockPaperScissorGameScore,
} from "./rock-paper-scissors-slice";
import { desc } from "drizzle-orm";

describe("rock paper scissors slice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2023-01-01T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("by default, players can't choose", async () => {
    const { getState } = testSetup();

    expect(getState().gameLogic.mutable.player1.canChoose).toBe(false);
    expect(getState().gameLogic.mutable.player2.canChoose).toBe(false);
  });

  describe("game flow", () => {
    test("should enable choosing when the game starts", async () => {
      const { getState, startGame } = testSetup();
      startGame();

      expect(getState().gameLogic.mutable.player1.canChoose).toBe(true);
      expect(getState().gameLogic.mutable.player2.canChoose).toBe(true);
    });

    test('should choose item "rock" when player 1 chooses', async () => {
      const { getState, startGame, chooseItem, player1Id } = testSetup();

      startGame();
      chooseItem(player1Id, "rock");

      expect(getState().gameLogic.mutable.player1.item).toBe("rock");
    });

    test("should not be possible to choose again", async () => {
      const { startGame, chooseItem, player1Id } = testSetup();

      startGame();
      chooseItem(player1Id, "rock");

      expect(chooseItem(player1Id, "paper")).toBe("player already chosen");
    });

    test("both players should be able to choose", async () => {
      const { getState, startGame, chooseItem, player1Id, player2Id } =
        testSetup();

      startGame();
      chooseItem(player1Id, "rock");
      chooseItem(player2Id, "paper");

      expect(getState().gameLogic.mutable.player1.item).toBe("rock");
      expect(getState().gameLogic.mutable.player2.item).toBe("paper");
    });

    describe("winning a round", () => {
      (
        [
          { p1: "rock", p2: "rock", outcome: { type: "tie" } },
          { p1: "rock", p2: "paper", outcome: { type: "win", winnerId: "p2" } },
          {
            p1: "rock",
            p2: "scissors",
            outcome: { type: "win", winnerId: "p1" },
          },
          { p1: "paper", p2: "rock", outcome: { type: "win", winnerId: "p1" } },
          {
            p1: "paper",
            p2: "paper",
            outcome: { type: "tie" },
          },
          {
            p1: "paper",
            p2: "scissors",
            outcome: { type: "win", winnerId: "p2" },
          },
          {
            p1: "paper",
            p2: "rock",
            outcome: { type: "win", winnerId: "p1" },
          },
          {
            p1: "scissors",
            p2: "rock",
            outcome: { type: "win", winnerId: "p2" },
          },
          {
            p1: "scissors",
            p2: "paper",
            outcome: { type: "win", winnerId: "p1" },
          },
          {
            p1: "scissors",
            p2: "scissors",
            outcome: { type: "tie" },
          },
        ] satisfies Array<{
          p1: RockPaperScissorsItem;
          p2: RockPaperScissorsItem;
          outcome: Pick<RockPaperScissorGameScore, "type" | "winnerId">;
        }>
      ).forEach((config) => {
        test(`p1 '${config.p1}' vs p2 '${config.p2}' should be a (${config.outcome.type})${config.outcome.type === "tie" ? "" : " -> " + config.outcome.winnerId}`, async () => {
          const { getState, startGame, chooseItem, player1Id, player2Id } =
            testSetup();

          startGame();
          chooseItem(player1Id, config.p1);
          chooseItem(player2Id, config.p2);

          const winnerId =
            config.outcome.type === "tie"
              ? undefined
              : config.outcome.winnerId === "p1"
                ? player1Id
                : player2Id;

          expect(getState().gameLogic.mutable.score).toEqual([
            {
              type: config.outcome.type,
              winnerId,
              player1: config.p1,
              player2: config.p2,
            },
          ]);
        });
      });
    });
  });

  describe("game timers", () => {});
});

function testSetup() {
  const player1Id = "player1";
  const player2Id = "player2";
  const durations = {
    chooseTimeout: Temporal.Duration.from({ seconds: 10 }),
    showCurrentScore: Temporal.Duration.from({ seconds: 10 }),
  };
  const store = createStore<RockPaperScissorsRequirements>()(
    subscribeWithSelector((...a) => ({
      ...createRockPaperScissorsSlice(player1Id, player2Id)(...a),
      ...createTimerSlice("timerRpsChooseTimeout", durations.chooseTimeout, {
        shouldUpdateStateEverySecond: true,
        countDirection: "down-from-end",
      })(...a),
      ...createTimerSlice("timerRpsShowCurrentScore", durations.chooseTimeout, {
        shouldUpdateStateEverySecond: true,
        countDirection: "down-from-end",
      })(...a),
      ...createPlayerConnectionRequirement(player1Id, player2Id, {
        forceStop: Temporal.Duration.from({ seconds: 120 }),
        disconnectLoose: Temporal.Duration.from({ seconds: 10 }),
        startTimeout: Temporal.Duration.from({ seconds: 10 }),
      })(...a),
    })),
  );

  registerRockPaperScissorsSubscribers(
    store as SubscribeStore<RockPaperScissorsRequirements>,
  );

  const getState = () => {
    return store.getState();
  };
  const { connectPlayer, markReady, disconnectPlayer } =
    getState().playerConnection;

  return {
    getState,
    player1Id,
    player2Id,
    // eslint-disable-next-line @typescript-eslint/unbound-method
    chooseItem: getState().gameLogic.chooseItem,
    startGame: () => {
      connectPlayer(player1Id);
      connectPlayer(player2Id);
      markReady(player1Id);
      markReady(player2Id);
    },
    connectPlayer,
    disconnectPlayer,
    durations,
  };
}
