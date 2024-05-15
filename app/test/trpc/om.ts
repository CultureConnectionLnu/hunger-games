/* eslint-disable react-hooks/rules-of-hooks */
import { describe, expect, it, vi } from "vitest";
import type { BaseGamePlayerEvents } from "~/server/api/logic/core/base-game";
import { type GetTimerEvents } from "~/server/api/logic/core/types";
import { type OrderedMemoryEvents } from "~/server/api/logic/games/om";
import {
  lobbyHandler,
  type OrderedMemoryGame,
} from "~/server/api/logic/handler";
import { type OrderedMemoryPlayerEvents } from "~/server/api/routers/games/ordered-memory";
import {
  cleanupLeftovers,
  expectEventEmitted,
  getLastEventOf,
  getManualTimer,
  getTestUserCallers,
  makePlayer,
  runAllMacroTasks,
  useAutomaticTimer,
  useManualTimer,
} from "./utils";

export const omTests = () =>
  describe("Ordered Memory", () => {
    makePlayer("test_user_1");
    makePlayer("test_user_2");

    describe("Evaluation", () => {
      it("should be a draw no one inputs the pattern", () =>
        testFight(async ({ startGame, timeoutTimer, expectDraw }) => {
          await startGame();

          await timeoutTimer("show-timer");
          await timeoutTimer("input-timer");

          await expectDraw();
        }));

      it("should be a draw if both input the wrong pattern", () =>
        testFight(
          async ({
            startGame,
            timeoutTimer,
            inputIncorrectPattern,
            expectDraw,
          }) => {
            await startGame(true);
            await timeoutTimer("show-timer");

            await inputIncorrectPattern("test_user_1");
            await inputIncorrectPattern("test_user_2");

            await expectDraw();
          },
        ));

      it("player 1 should win when only he enters the correct pattern", () =>
        testFight(
          async ({
            startGame,
            timeoutTimer,
            inputCorrectPattern,
            inputIncorrectPattern,
            expectGameEnded,
          }) => {
            await startGame(true);
            await timeoutTimer("show-timer");

            await inputCorrectPattern("test_user_1");
            await inputIncorrectPattern("test_user_2");

            await expectGameEnded("test_user_1");
          },
        ));

      it("player 2 should win when only he enters the correct pattern", () =>
        testFight(
          async ({
            startGame,
            timeoutTimer,
            inputCorrectPattern,
            inputIncorrectPattern,
            expectGameEnded,
          }) => {
            await startGame(true);
            await timeoutTimer("show-timer");

            await inputCorrectPattern("test_user_2");
            await inputIncorrectPattern("test_user_1");

            await expectGameEnded("test_user_2");
          },
        ));

      it("should be draw if both enter correct pattern", () =>
        testFight(
          async ({
            startGame,
            timeoutTimer,
            inputCorrectPattern,
            expectDraw,
          }) => {
            await startGame(true);
            await timeoutTimer("show-timer");

            await inputCorrectPattern("test_user_1");
            await inputCorrectPattern("test_user_2");

            await expectDraw();
          },
        ));

      it("player 1 should win in round 2", () => {
        return testFight(
          async ({
            startGame,
            timeoutTimer,
            inputCorrectPattern,
            inputIncorrectPattern,
            expectGameEnded,
          }) => {
            await startGame(true);

            //round 1
            await timeoutTimer("show-timer");
            await inputCorrectPattern("test_user_1");
            await inputCorrectPattern("test_user_2");
            await timeoutTimer("next-round-timer");

            //round 2
            await timeoutTimer("show-timer");
            await inputCorrectPattern("test_user_1");
            await inputIncorrectPattern("test_user_2");

            await expectGameEnded("test_user_1");
          },
        );
      });
    });

    describe("Rounds", () => {
      it("should have one item in first round", () =>
        testFight(async ({ startGame, timeoutTimer, firstRpsListener }) => {
          await startGame();
          await timeoutTimer("show-timer");
          const event = getLastEventOf(firstRpsListener, "show-pattern");
          expect(event?.data.pattern).toHaveLength(1);
        }));

      it("should have two items in second round", () =>
        testFight(async ({ startGame, timeoutTimer, firstRpsListener }) => {
          await startGame();
          await timeoutTimer("show-timer");
          await timeoutTimer("input-timer");
          await timeoutTimer("next-round-timer");
          await timeoutTimer("show-timer");

          const event = getLastEventOf(firstRpsListener, "show-pattern");
          expect(event?.data.pattern).toHaveLength(2);
        }));

      it("should have 16 items in round 16", () =>
        testFight(async ({ startGame, timeoutTimer, firstRpsListener }) => {
          await startGame();

          for (let i = 0; i < 16; i++) {
            await timeoutTimer("show-timer");
            await timeoutTimer("input-timer");
            await timeoutTimer("next-round-timer");
          }

          await timeoutTimer("show-timer");
          const event = getLastEventOf(firstRpsListener, "show-pattern");
          expect(event?.data.pattern).toHaveLength(16);
        }));

      it("should not have more than 16 items in round after 16", () =>
        testFight(async ({ startGame, timeoutTimer, firstRpsListener }) => {
          await startGame();

          for (let i = 0; i < 17; i++) {
            await timeoutTimer("show-timer");
            await timeoutTimer("input-timer");
            await timeoutTimer("next-round-timer");
          }

          await timeoutTimer("show-timer");
          const event = getLastEventOf(firstRpsListener, "show-pattern");
          expect(event?.data.pattern).toHaveLength(16);
        }));
    });

    describe("Views", () => {
      it("after game start, should show 'show-pattern' view", () =>
        testFight(
          async ({ startGame, firstRpsListener, secondRpsListener }) => {
            await startGame();

            expect(
              getLastEventOf(firstRpsListener, "show-pattern")?.view,
            ).toEqual("show-pattern");
            expect(
              getLastEventOf(secondRpsListener, "show-pattern")?.view,
            ).toEqual("show-pattern");
          },
        ));

      it("once the 'show-timer' is done, it should show the 'input-pattern' view", () =>
        testFight(async ({ startGame, timeoutTimer, firstRpsListener }) => {
          await startGame();
          await timeoutTimer("show-timer");

          expect(
            getLastEventOf(firstRpsListener, "enable-input")?.view,
          ).toEqual("input-pattern");
        }));

      it("when the user clicks on any card, the view should change to 'wait-for-opponent'", () =>
        testFight(
          async ({
            startGame,
            timeoutTimer,
            inputCorrectPattern,
            firstRpsListener,
          }) => {
            await startGame();
            await timeoutTimer("show-timer");
            await inputCorrectPattern("test_user_1");

            expect(
              getLastEventOf(firstRpsListener, "show-waiting")?.view,
            ).toEqual("wait-for-opponent");
          },
        ));

      it('when both players have clicked on the correct card, then the view should change to "show-result"', () =>
        testFight(
          async ({
            startGame,
            timeoutTimer,
            inputCorrectPattern,
            firstRpsListener,
          }) => {
            await startGame();
            await timeoutTimer("show-timer");
            await inputCorrectPattern("test_user_1");
            await inputCorrectPattern("test_user_2");

            expect(
              getLastEventOf(firstRpsListener, "show-result")?.view,
            ).toEqual("show-result");
          },
        ));

      it('when both players clicked the wrong card, then the view should change to "show-result"', () =>
        testFight(
          async ({
            startGame,
            timeoutTimer,
            inputIncorrectPattern,
            firstRpsListener,
          }) => {
            await startGame(true);
            await timeoutTimer("show-timer");
            await inputIncorrectPattern("test_user_1");
            await inputIncorrectPattern("test_user_2");

            expect(
              getLastEventOf(firstRpsListener, "show-result")?.view,
            ).toEqual("show-result");
          },
        ));

      it('when round 2 starts, then it should show "input-pattern" view after show pattern', () =>
        testFight(
          async ({
            startGame,
            timeoutTimer,
            inputCorrectPattern,
            firstRpsListener,
          }) => {
            await startGame(true);
            await timeoutTimer("show-timer");
            await inputCorrectPattern("test_user_1");
            await inputCorrectPattern("test_user_2");
            await timeoutTimer("next-round-timer");
            await timeoutTimer("show-timer");

            expect(
              getLastEventOf(firstRpsListener, "enable-input")?.view,
            ).toEqual("input-pattern");
          },
        ));
    });

    describe("Timers", () => {
      it("should start show timer", () =>
        testFight(async ({ startGame, expectRunningTimer }) => {
          await startGame();
          expectRunningTimer("show-timer");
        }));

      it("should show input timer when input starts", () =>
        testFight(async ({ startGame, timeoutTimer, expectRunningTimer }) => {
          await startGame();
          await timeoutTimer("show-timer");
          expectRunningTimer("input-timer");
        }));

      it("should start next round timer, if the game is not over", () =>
        testFight(async ({ startGame, timeoutTimer, expectRunningTimer }) => {
          await startGame();

          await timeoutTimer("show-timer");
          await timeoutTimer("input-timer");

          expectRunningTimer("next-round-timer");
        }));

      it("should not show next round timer, if the game is over", () =>
        testFight(
          async ({
            startGame,
            timeoutTimer,
            expectNotRunningTimer,
            inputCorrectPattern,
          }) => {
            await startGame();

            await timeoutTimer("show-timer");
            await inputCorrectPattern("test_user_1");
            await timeoutTimer("input-timer");

            expectNotRunningTimer("next-round-timer");
          },
        ));

      it("should start show timer again after next round timer", () =>
        testFight(async ({ startGame, timeoutTimer, expectRunningTimer }) => {
          await startGame();

          await timeoutTimer("show-timer");
          await timeoutTimer("input-timer");
          await timeoutTimer("next-round-timer");

          expectRunningTimer("show-timer");
        }));

      it("in round 2 should show input timer after show timer", () =>
        testFight(async ({ startGame, timeoutTimer, expectRunningTimer }) => {
          await startGame(true);

          await timeoutTimer("show-timer");
          await timeoutTimer("input-timer");
          await timeoutTimer("next-round-timer");

          await timeoutTimer("show-timer");
          expectRunningTimer("input-timer");
        }));
    });
  });

async function testFight(
  test: (args: Awaited<ReturnType<typeof setupTest>>) => Promise<void>,
) {
  useManualTimer();
  const args = await setupTest();

  return await test(args)
    .then(() => ({ pass: true, error: undefined }) as const)
    .catch((error: Error) => ({ pass: false, error }) as const)
    .then(async (x) => {
      const id = args.getFightId();
      useAutomaticTimer();
      if (id === undefined) return x;

      // finish the game properly before deleting
      args.getFight().lobby.endGame("test_user_1", "test_user_2");
      await args.getFight().gameDone;
      await cleanupLeftovers({
        fightIds: [id],
      });
      return x;
    })
    .then(({ pass, error }) => {
      if (!pass) {
        throw error;
      }
    });
}

async function setupTest() {
  const callers = await getTestUserCallers();

  const firstListener = vi.fn<[BaseGamePlayerEvents], void>();
  const secondListener = vi.fn<[BaseGamePlayerEvents], void>();
  const firstRpsListener = vi.fn<[OrderedMemoryPlayerEvents], void>();
  const secondRpsListener = vi.fn<[OrderedMemoryPlayerEvents], void>();
  lobbyHandler.defineNextGameType("ordered-memory");

  const { id: fightId } = await callers.test_user_1.lobby.create({
    opponent: `test_user_2`,
  });

  await callers.test_user_1.lobby.join();
  await callers.test_user_2.lobby.join();

  const state = {
    fightId,
    fight: lobbyHandler.getFight(fightId) as OrderedMemoryGame,
    test_user_1: {
      base: (
        await callers.test_user_1.lobby.onGameAction({
          userId: "test_user_1",
          fightId,
        })
      ).subscribe({ next: (event) => firstListener(event) }),
      rps: (
        await callers.test_user_1.orderedMemory.onAction({
          userId: "test_user_1",
          fightId,
        })
      ).subscribe({ next: (event) => firstRpsListener(event) }),
    },
    test_user_2: {
      base: (
        await callers.test_user_2.lobby.onGameAction({
          userId: "test_user_2",
          fightId,
        })
      ).subscribe({ next: (event) => secondListener(event) }),
      rps: (
        await callers.test_user_2.orderedMemory.onAction({
          userId: "test_user_2",
          fightId,
        })
      ).subscribe({ next: (event) => secondRpsListener(event) }),
    },
  };

  const startGame = async (disableRandom = false) => {
    state.fight.game.disableRandom = disableRandom;
    await callers.test_user_1.lobby.ready();
    await callers.test_user_2.lobby.ready();
    await runAllMacroTasks();
    await runAllMacroTasks();
  };

  const clickCard = async (
    player: `test_user_${1 | 2}`,
    position: { row: number; col: number },
  ) => await callers[player].orderedMemory.clickCard(position);

  const timer = getManualTimer();
  type KnownTimers = GetTimerEvents<OrderedMemoryEvents>;

  return {
    getFightId: () => state.fightId,
    getGame: () => state.fight.game,
    getFight: () => state.fight,
    timer,
    startGame,
    firstListener,
    firstRpsListener,
    secondListener,
    secondRpsListener,
    expectGameEnded: async (winnerId: `test_user_${1 | 2}`) => {
      expectEventEmitted(firstListener, "game-ended");
      const event = getLastEventOf(firstListener, "game-ended");
      expect(event?.data).toEqual({
        winnerId,
        looserId: winnerId === "test_user_1" ? "test_user_2" : "test_user_1",
      });
    },
    expectDraw: async () => {
      expectEventEmitted(firstRpsListener, "show-result");
      const event = getLastEventOf(firstRpsListener, "show-result");
      expect(event?.data).toEqual({
        outcome: "draw",
        yourName: "Test User 1",
        opponentName: "Test User 2",
      });
    },
    inputCorrectPattern: async (player: `test_user_${1 | 2}`) => {
      const toBeClicked = getLastEventOf(firstRpsListener, "show-pattern")!.data
        .pattern;
      for (const next of toBeClicked) {
        await clickCard(player, next);
      }
    },
    inputIncorrectPattern: async (player: `test_user_${1 | 2}`) => {
      expect(state.fight?.game.disableRandom).toBe(true);
      // it starts with 0,0
      // therefore clicking anything else is wrong
      await clickCard(player, { row: 1, col: 0 });
    },
    expectRunningTimer: (name: KnownTimers) => {
      expect(() => timer.getLastRunningByName(name)).not.toThrow();
      expect(
        getLastEventOf(firstRpsListener, name)?.data.secondsLeft,
      ).toBeGreaterThan(0);
    },
    expectNotRunningTimer: (name: KnownTimers) => {
      expect(() => timer.getLastRunningByName(name)).toThrow();
    },
    timeoutTimer: async (name: KnownTimers) => {
      timer.getLastRunningByName(name).emitTimeout();
      await runAllMacroTasks();
    },
  };
}
