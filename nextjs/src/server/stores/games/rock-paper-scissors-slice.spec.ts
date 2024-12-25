import { Temporal } from "temporal-polyfill";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createRockPaperScissorsRequirement } from "../core/creator";
import { type SubscribeStore } from "../core/zustand-helper";
import {
  registerRockPaperScissorsSubscribers,
  type RockPaperScissorGameScore,
  type RockPaperScissorsItem,
  type RockPaperScissorsRequirements,
} from "./rock-paper-scissors-slice";

describe("rock paper scissors slice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2023-01-01T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("before game starts", () => {
    test("by default, players can't choose", async () => {
      const { getState } = testSetup();

      expect(getState().gameLogic.mutable.player1.canChoose).toBe(false);
      expect(getState().gameLogic.mutable.player2.canChoose).toBe(false);
    });

    test("should not be possible to choose", async () => {
      const { chooseItem, player1Id } = testSetup();

      expect(chooseItem(player1Id, "rock")).toBe("choosing is disabled");
    });

    test("choose timeout is not running", async () => {
      const { getState } = testSetup();

      expect(getState().timerRpsChooseTimeout.mutable.isActive).toBe(false);
    });

    test("should show provide the options configured", async () => {
      const { getState } = testSetup({
        roundsLimit: 1,
        roundsNeededToWin: 1,
      });

      expect(getState().gameLogic.options).toEqual({
        roundsLimit: 1,
        roundsNeededToWin: 1,
      });
    });
  });

  describe("round 1", () => {
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

    describe("choose timeout", () => {
      test("should start the 'choose timeout' timer", async () => {
        const { getState, startGame } = testSetup();

        startGame();

        expect(getState().timerRpsChooseTimeout.mutable.isActive).toBe(true);
      });

      test("should be a tie if no one chooses and time runs out", async () => {
        const { getState, startGame, durations } = testSetup();

        startGame();
        await vi.advanceTimersByTimeAsync(
          durations.chooseTimeout.total({ unit: "milliseconds" }),
        );

        expect(getState().gameLogic.mutable.score).toEqual([
          {
            type: "tie",
            player1: undefined,
            player2: undefined,
          },
        ]);
      });

      test("should be a win if only one player chooses and time runs out", async () => {
        const { getState, startGame, chooseItem, player1Id, durations } =
          testSetup();

        startGame();
        chooseItem(player1Id, "rock");
        await vi.advanceTimersByTimeAsync(
          durations.chooseTimeout.total({ unit: "milliseconds" }),
        );

        expect(getState().gameLogic.mutable.score).toEqual([
          {
            type: "win",
            winnerId: player1Id,
            player1: "rock",
            player2: undefined,
          },
        ]);
      });

      test("should be a win if only one player chooses and time runs out (alternative order)", async () => {
        const { getState, startGame, chooseItem, player2Id, durations } =
          testSetup();

        startGame();
        chooseItem(player2Id, "paper");
        await vi.advanceTimersByTimeAsync(
          durations.chooseTimeout.total({ unit: "milliseconds" }),
        );

        expect(getState().gameLogic.mutable.score).toEqual([
          {
            type: "win",
            winnerId: player2Id,
            player1: undefined,
            player2: "paper",
          },
        ]);
      });

      test('should cancel the "choose timeout" timer when both players choose', async () => {
        const { getState, startGame, chooseItem, player1Id, player2Id } =
          testSetup();

        startGame();
        chooseItem(player1Id, "rock");
        chooseItem(player2Id, "paper");

        expect(getState().timerRpsChooseTimeout.mutable.canceled).toBe(true);
      });
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

    test("should disable choosing when both players choose", async () => {
      const { getState, startGame, chooseItem, player1Id, player2Id } =
        testSetup();

      startGame();
      chooseItem(player1Id, "rock");
      chooseItem(player2Id, "paper");

      expect(getState().gameLogic.mutable.player1.canChoose).toBe(false);
      expect(getState().gameLogic.mutable.player2.canChoose).toBe(false);
    });

    describe("show current score timeout", () => {
      test("should start 'show current score' timer", async () => {
        const { getState, startGame, chooseItem, player1Id, player2Id } =
          testSetup();

        startGame();
        chooseItem(player1Id, "rock");
        chooseItem(player2Id, "paper");

        expect(getState().timerRpsShowCurrentScore.mutable.isActive).toBe(true);
      });
    });
  });

  describe("round 2", () => {
    test("should enable choosing again upon starting the next round", async () => {
      const { getState, startGame, player1Id, letPlayerWinRound } = testSetup();

      startGame();
      await letPlayerWinRound(player1Id);

      expect(getState().gameLogic.mutable.player1.canChoose).toBe(true);
      expect(getState().gameLogic.mutable.player2.canChoose).toBe(true);
    });

    test("should have no items selected upon starting the next round", async () => {
      const { getState, startGame, player1Id, letPlayerWinRound } = testSetup();

      startGame();
      await letPlayerWinRound(player1Id);

      expect(getState().gameLogic.mutable.player1.item).toBe(undefined);
      expect(getState().gameLogic.mutable.player2.item).toBe(undefined);
    });

    test("should start the 'choose timeout' timer again", async () => {
      const { getState, startGame, player1Id, letPlayerWinRound } = testSetup();

      startGame();
      await letPlayerWinRound(player1Id);

      expect(getState().timerRpsChooseTimeout.mutable.isActive).toBe(true);
    });

    test("should reset the 'show current score' timer", async () => {
      const { getState, startGame, player1Id, letPlayerWinRound } = testSetup();

      startGame();
      await letPlayerWinRound(player1Id);

      expect(getState().timerRpsShowCurrentScore.mutable.isActive).toBe(false);
      expect(getState().timerRpsShowCurrentScore.mutable.completed).toBe(false);
    });

    test("should select item 'rock' when player 1 chooses", async () => {
      const { getState, startGame, player1Id, chooseItem, letPlayerWinRound } =
        testSetup();

      startGame();
      await letPlayerWinRound(player1Id);
      chooseItem(player1Id, "rock");

      expect(getState().gameLogic.mutable.player1.item).toBe("rock");
      expect(getState().gameLogic.mutable.player2.item).toBe(undefined);
    });
  });

  describe("winning the game", () => {
    test("player should win the game", async () => {
      const { getState, startGame, player1Id, player2Id, letPlayerWinRound } =
        testSetup({
          roundsNeededToWin: 3,
        });

      startGame();
      await letPlayerWinRound(player1Id);
      await letPlayerWinRound(player1Id);
      await letPlayerWinRound(player1Id);

      expect(getState().gameResult.outcome).toEqual({
        result: "winner",
        winnerId: player1Id,
        looserId: player2Id,
        reason: "game-result",
      });
    });

    test("player should win the game (alternative order)", async () => {
      const { getState, startGame, player1Id, player2Id, letPlayerWinRound } =
        testSetup({
          roundsNeededToWin: 3,
        });

      startGame();
      await letPlayerWinRound(player1Id);
      await letPlayerWinRound(player1Id);
      await letPlayerWinRound(player2Id);
      await letPlayerWinRound(player2Id);

      await letPlayerWinRound(player2Id);

      expect(getState().gameResult.outcome).toEqual({
        result: "winner",
        winnerId: player2Id,
        looserId: player1Id,
        reason: "game-result",
      });
    });

    test("should limit the number of rounds possible to play", async () => {
      const { getState, startGame, letPlayersTieRound } = testSetup({
        roundsLimit: 3,
      });

      startGame();
      await letPlayersTieRound();
      await letPlayersTieRound();
      await letPlayersTieRound();

      expect(getState().gameResult.outcome).toEqual({
        result: "tie",
        winnerId: undefined,
        looserId: undefined,
        reason: "game-result",
      });
    });

    test("upon reaching the limit, the player with the most wins is the overall winner", async () => {
      const {
        getState,
        player1Id,
        player2Id,
        startGame,
        letPlayersTieRound,
        letPlayerWinRound,
      } = testSetup({
        roundsLimit: 3,
      });

      startGame();
      await letPlayersTieRound();
      await letPlayersTieRound();
      await letPlayerWinRound(player1Id);

      expect(getState().gameResult.outcome).toEqual({
        result: "winner",
        winnerId: player1Id,
        looserId: player2Id,
        reason: "game-result",
      });
    });
  });

  describe("handle disconnects", () => {
    test("should pause 'choose timeout' timer", async () => {
      const { getState, startGame, player1Id, disconnectPlayer } = testSetup();

      startGame();
      disconnectPlayer(player1Id);

      expect(getState().timerRpsChooseTimeout.mutable.isActive).toBe(false);
    });

    test("should resume 'choose timeout' timer", async () => {
      const {
        getState,
        startGame,
        player1Id,
        disconnectPlayer,
        connectPlayer,
      } = testSetup();

      startGame();
      disconnectPlayer(player1Id);
      connectPlayer(player1Id);

      expect(getState().timerRpsChooseTimeout.mutable.isActive).toBe(true);
    });

    test("should have the same player state as before the disconnect", async () => {
      const {
        getState,
        startGame,
        player1Id,
        chooseItem,
        disconnectPlayer,
        connectPlayer,
      } = testSetup();
      startGame();
      chooseItem(player1Id, "rock");

      const currentState = getState().gameLogic.mutable;
      disconnectPlayer(player1Id);
      connectPlayer(player1Id);

      const newState = getState().gameLogic.mutable;
      expect(newState.player1).toEqual(currentState.player1);
      expect(newState.player2).toEqual(currentState.player2);
      expect(newState.score).toEqual(currentState.score);
    });

    test("should not allow to select while the game is paused", async () => {
      const {
        getState,
        player1Id,
        player2Id,
        startGame,
        chooseItem,
        disconnectPlayer,
      } = testSetup();

      startGame();
      disconnectPlayer(player1Id);
      chooseItem(player2Id, "rock");

      expect(getState().gameLogic.mutable.player2.item).toBe(undefined);
    });

    test("should pause 'show current score' timer", async () => {
      const {
        getState,
        startGame,
        chooseItem,
        player1Id,
        player2Id,
        disconnectPlayer,
      } = testSetup();

      startGame();
      chooseItem(player1Id, "rock");
      chooseItem(player2Id, "rock");
      disconnectPlayer(player1Id);

      expect(getState().timerRpsShowCurrentScore.mutable.isActive).toBe(false);
    });

    test("should resume 'show current score' timer", async () => {
      const {
        getState,
        startGame,
        chooseItem,
        player1Id,
        player2Id,
        disconnectPlayer,
        connectPlayer,
      } = testSetup();

      startGame();
      chooseItem(player1Id, "rock");
      chooseItem(player2Id, "rock");
      disconnectPlayer(player1Id);
      connectPlayer(player1Id);

      expect(getState().timerRpsShowCurrentScore.mutable.isActive).toBe(true);
    });
  });
});

function testSetup({
  roundsNeededToWin,
  roundsLimit,
}: { roundsNeededToWin?: number; roundsLimit?: number } = {}) {
  const player1Id = "player1";
  const player2Id = "player2";
  const durations = {
    chooseTimeout: Temporal.Duration.from({ seconds: 10 }),
    showCurrentScore: Temporal.Duration.from({ seconds: 10 }),
  };
  const store = createStore<RockPaperScissorsRequirements>()(
    subscribeWithSelector((...a) => ({
      ...createRockPaperScissorsRequirement(
        player1Id,
        player2Id,
        {
          forceStop: Temporal.Duration.from({ seconds: 120 }),
          disconnectLoose: Temporal.Duration.from({ seconds: 10 }),
          startTimeout: Temporal.Duration.from({ seconds: 10 }),
        },
        {
          durations,
          roundsNeededToWin: roundsNeededToWin ?? 3,
          roundsLimit: roundsLimit ?? 10,
        },
      )(...a),
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
        durations.showCurrentScore.total({ unit: "milliseconds" }),
      );
    },
    letPlayersTieRound: async () => {
      chooseItem(player1Id, "rock");
      chooseItem(player2Id, "rock");
      await vi.advanceTimersByTimeAsync(
        durations.showCurrentScore.total({ unit: "milliseconds" }),
      );
    },
    connectPlayer,
    disconnectPlayer,
    durations,
  };
}
