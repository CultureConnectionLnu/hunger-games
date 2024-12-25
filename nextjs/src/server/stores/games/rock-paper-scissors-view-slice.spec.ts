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

      expect(getState().gameView.mutable.player1.showView).toBe("none");
      expect(getState().gameView.mutable.player2.showView).toBe("none");
    });

    test("by default, scores are empty", async () => {
      const { getState } = testSetup();

      expect(getState().gameView.mutable.player1.score).toEqual({
        currentRound: 0,
        roundLimit: 0,
        roundsNeededToWin: 0,
        yourScore: 0,
        opponentScore: 0,
      });
      expect(getState().gameView.mutable.player2.score).toEqual({
        currentRound: 0,
        roundLimit: 0,
        roundsNeededToWin: 0,
        yourScore: 0,
        opponentScore: 0,
      });
    });
  });

  describe("round 1", () => {
    test('should show "choose" view when the game starts', async () => {
      const { getState, startGame } = testSetup();

      startGame();

      expect(getState().gameView.mutable.player1.showView).toBe("choose");
      expect(getState().gameView.mutable.player2.showView).toBe("choose");
    });

    test("should provide the correct roundLimit and currentRound numbers", async () => {
      const { getState, startGame } = testSetup({
        roundsLimit: 3,
        roundsNeededToWin: 2,
      });

      startGame();

      expect(getState().gameView.mutable.player1.score).toEqual({
        currentRound: 1,
        roundLimit: 3,
        roundsNeededToWin: 2,
        yourScore: 0,
        opponentScore: 0,
      });
      expect(getState().gameView.mutable.player2.score).toEqual({
        currentRound: 1,
        roundLimit: 3,
        roundsNeededToWin: 2,
        yourScore: 0,
        opponentScore: 0,
      });
    });

    test("should show 'wait-for-other-player-to-choose' view upon choosing", async () => {
      const { getState, startGame, chooseItem, player1Id } = testSetup();
      startGame();
      chooseItem(player1Id, "rock");

      expect(getState().gameView.mutable.player1.showView).toBe(
        "waiting-for-other-player-choose",
      );
      expect(getState().gameView.mutable.player2.showView).toBe("choose");
    });

    test("should show 'wait-for-other-player-to-choose' view upon choosing (alternative order)", async () => {
      const { getState, startGame, chooseItem, player2Id } = testSetup();
      startGame();
      chooseItem(player2Id, "rock");

      expect(getState().gameView.mutable.player2.showView).toBe(
        "waiting-for-other-player-choose",
      );
      expect(getState().gameView.mutable.player1.showView).toBe("choose");
    });

    test("should update 'choose timeout' value", async () => {
      const { getState, startGame } = testSetup({
        durations: {
          chooseTimeout: Temporal.Duration.from({ seconds: 5 }),
        },
      });
      startGame();

      expect(getState().gameView.mutable.player1.timer.chooseTimeout).toEqual({
        visible: true,
        formattedTime: "00:05",
      });

      await vi.advanceTimersByTimeAsync(1000);

      expect(getState().gameView.mutable.player1.timer.chooseTimeout).toEqual({
        visible: true,
        formattedTime: "00:04",
      });
    });

    test("should show 'show-results' view upon both player selecting", async () => {
      const { getState, startGame, chooseItem, player1Id, player2Id } =
        testSetup();
      startGame();
      chooseItem(player1Id, "rock");
      chooseItem(player2Id, "paper");

      expect(getState().gameView.mutable.player1.showView).toBe(
        "show-round-results",
      );
      expect(getState().gameView.mutable.player2.showView).toBe(
        "show-round-results",
      );
    });

    describe("update score", () => {
      test("player 1 should have a score of 1", async () => {
        const { getState, startGame, chooseItem, player1Id, player2Id } =
          testSetup();

        startGame();
        chooseItem(player1Id, "rock");
        chooseItem(player2Id, "scissors");

        expect(getState().gameView.mutable.player1.score.yourScore).toBe(1);
        expect(getState().gameView.mutable.player1.score.opponentScore).toBe(0);

        expect(getState().gameView.mutable.player2.score.yourScore).toBe(0);
        expect(getState().gameView.mutable.player2.score.opponentScore).toBe(1);
      });

      test("player 2 should have a score of 1", async () => {
        const { getState, startGame, chooseItem, player1Id, player2Id } =
          testSetup();

        startGame();
        chooseItem(player2Id, "rock");
        chooseItem(player1Id, "scissors");

        expect(getState().gameView.mutable.player1.score.yourScore).toBe(0);
        expect(getState().gameView.mutable.player1.score.opponentScore).toBe(1);

        expect(getState().gameView.mutable.player2.score.yourScore).toBe(1);
        expect(getState().gameView.mutable.player2.score.opponentScore).toBe(0);
      });

      test("both players should have score of 0", async () => {
        const { getState, startGame, chooseItem, player1Id, player2Id } =
          testSetup();

        startGame();
        chooseItem(player1Id, "rock");
        chooseItem(player2Id, "rock");

        expect(getState().gameView.mutable.player1.score.yourScore).toBe(0);
        expect(getState().gameView.mutable.player1.score.opponentScore).toBe(0);

        expect(getState().gameView.mutable.player2.score.yourScore).toBe(0);
        expect(getState().gameView.mutable.player2.score.opponentScore).toBe(0);
      });
    });

    describe("round result", () => {
      test("player 1 should win", async () => {
        const { getState, startGame, player1Id, player2Id, chooseItem } =
          testSetup();

        startGame();
        chooseItem(player1Id, "rock");
        chooseItem(player2Id, "scissors");

        expect(getState().gameView.mutable.player1.roundResult).toEqual({
          youChoose: "rock",
          opponentChoose: "scissors",
          youWon: true,
          yourId: player1Id,
          opponentId: player2Id,
        });
        expect(getState().gameView.mutable.player2.roundResult).toEqual({
          youChoose: "scissors",
          opponentChoose: "rock",
          youWon: false,
          yourId: player2Id,
          opponentId: player1Id,
        });
      });

      test("player 2 should win", async () => {
        const { getState, startGame, player1Id, player2Id, chooseItem } =
          testSetup();

        startGame();
        chooseItem(player2Id, "rock");
        chooseItem(player1Id, "scissors");

        expect(getState().gameView.mutable.player1.roundResult).toEqual({
          youChoose: "scissors",
          opponentChoose: "rock",
          youWon: false,
          yourId: player1Id,
          opponentId: player2Id,
        });
        expect(getState().gameView.mutable.player2.roundResult).toEqual({
          youChoose: "rock",
          opponentChoose: "scissors",
          youWon: true,
          yourId: player2Id,
          opponentId: player1Id,
        });
      });

      test("should be a tie", async () => {
        const { getState, startGame, player1Id, player2Id, chooseItem } =
          testSetup();

        startGame();
        chooseItem(player1Id, "rock");
        chooseItem(player2Id, "rock");

        expect(getState().gameView.mutable.player1.roundResult).toEqual({
          youChoose: "rock",
          opponentChoose: "rock",
          youWon: false,
          yourId: player1Id,
          opponentId: player2Id,
        });
        expect(getState().gameView.mutable.player2.roundResult).toEqual({
          youChoose: "rock",
          opponentChoose: "rock",
          youWon: false,
          yourId: player2Id,
          opponentId: player1Id,
        });
      });
    });

    test("should show 'round result' timer", async () => {
      const { getState, startGame, chooseItem, player1Id, player2Id } =
        testSetup({
          durations: {
            roundResult: Temporal.Duration.from({ seconds: 5 }),
          },
        });

      startGame();
      chooseItem(player1Id, "rock");
      chooseItem(player2Id, "scissors");

      expect(getState().gameView.mutable.player1.timer.roundResult).toEqual({
        visible: true,
        formattedTime: "00:05",
      });

      await vi.advanceTimersByTimeAsync(1000);

      expect(getState().gameView.mutable.player1.timer.roundResult).toEqual({
        visible: true,
        formattedTime: "00:04",
      });
    });
  });

  describe("round 2", () => {
    test('should show "choose" again', async () => {
      const { getState, startGame, player1Id, letPlayerWinRound } = testSetup();

      startGame();
      await letPlayerWinRound(player1Id);

      expect(getState().gameView.mutable.player1.showView).toBe("choose");
      expect(getState().gameView.mutable.player2.showView).toBe("choose");
    });

    test("should show second round", async () => {
      const { getState, startGame, player1Id, letPlayerWinRound } = testSetup();

      startGame();
      await letPlayerWinRound(player1Id);

      expect(getState().gameView.mutable.player1.score.currentRound).toBe(2);
      expect(getState().gameView.mutable.player2.score.currentRound).toBe(2);
    });
  });

  describe("handle disconnects", () => {
    test("should have same state after pause", async () => {
      const {
        getState,
        startGame,
        player1Id,
        disconnectPlayer,
        connectPlayer,
        letPlayerWinRound,
      } = testSetup();
      startGame();
      await letPlayerWinRound(player1Id);
      const currentState = getState().gameView.mutable;

      disconnectPlayer(player1Id);
      connectPlayer(player1Id);

      expect(getState().gameView.mutable).toEqual(currentState);
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
    roundResult?: Temporal.Duration;
  };
} = {}) {
  const player1Id = "player1";
  const player2Id = "player2";
  const usedDurations = {
    chooseTimeout: Temporal.Duration.from({ seconds: 10 }),
    roundResult: Temporal.Duration.from({ seconds: 10 }),
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
        usedDurations.roundResult.total({ unit: "milliseconds" }),
      );
    },
    letPlayersTieRound: async () => {
      chooseItem(player1Id, "rock");
      chooseItem(player2Id, "rock");
      await vi.advanceTimersByTimeAsync(
        usedDurations.roundResult.total({ unit: "milliseconds" }),
      );
    },
    connectPlayer,
    disconnectPlayer,
    durations: usedDurations,
  };
}
