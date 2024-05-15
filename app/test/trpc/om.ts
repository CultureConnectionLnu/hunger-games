/* eslint-disable react-hooks/rules-of-hooks */
import { describe, expect, it, vi } from "vitest";
import type { BaseGamePlayerEvents } from "~/server/api/logic/core/base-game";
import { lobbyHandler } from "~/server/api/logic/handler";
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
import { type OrderedMemoryPlayerEvents } from "~/server/api/routers/games/ordered-memory";

export const omTests = () =>
  describe("Ordered Memory", () => {
    makePlayer("test_user_1");
    makePlayer("test_user_2");

    describe("Evaluation", () => {
      it("should be a draw no one inputs the pattern", () =>
        testFight(async ({ startGame, timer, expectDraw }) => {
          await startGame();
          timer.getFirstByName("show-timer").emitTimeout();
          timer.getFirstByName("input-timer").emitTimeout();

          await expectDraw();
        }));

      it("should be a draw if both input the wrong pattern", () =>
        testFight(
          async ({ startGame, timer, inputIncorrectPattern, expectDraw }) => {
            await startGame(true);
            timer.getFirstByName("show-timer").emitTimeout();

            await inputIncorrectPattern("test_user_1");
            await inputIncorrectPattern("test_user_2");

            await expectDraw();
          },
        ));

      it("player 1 should win when only he enters the correct pattern", () =>
        testFight(
          async ({
            startGame,
            timer,
            inputCorrectPattern,
            inputIncorrectPattern,
            expectGameEnded,
          }) => {
            await startGame(true);
            timer.getFirstByName("show-timer").emitTimeout();

            await inputCorrectPattern("test_user_1");
            await inputIncorrectPattern("test_user_2");

            await expectGameEnded("test_user_1");
          },
        ));

      it("player 2 should win when only he enters the correct pattern", () =>
        testFight(
          async ({
            startGame,
            timer,
            inputCorrectPattern,
            inputIncorrectPattern,
            expectGameEnded,
          }) => {
            await startGame(true);
            timer.getFirstByName("show-timer").emitTimeout();

            await inputCorrectPattern("test_user_2");
            await inputIncorrectPattern("test_user_1");

            await expectGameEnded("test_user_2");
          },
        ));

      it("should be draw if both enter correct pattern", () =>
        testFight(
          async ({ startGame, timer, inputCorrectPattern, expectDraw }) => {
            await startGame(true);
            timer.getFirstByName("show-timer").emitTimeout();

            await inputCorrectPattern("test_user_1");
            await inputCorrectPattern("test_user_2");

            await expectDraw();
          },
        ));
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
        testFight(async ({ startGame, timer, firstRpsListener }) => {
          await startGame();
          timer.getFirstByName("show-timer").emitTimeout();

          expect(
            getLastEventOf(firstRpsListener, "enable-input")?.view,
          ).toEqual("input-pattern");
        }));

      it("when the user clicks on any card, the view should change to 'wait-for-opponent'", () =>
        testFight(
          async ({
            startGame,
            timer,
            inputCorrectPattern,
            firstRpsListener,
          }) => {
            await startGame();
            timer.getFirstByName("show-timer").emitTimeout();
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
            timer,
            inputCorrectPattern,
            firstRpsListener,
          }) => {
            await startGame();
            timer.getFirstByName("show-timer").emitTimeout();
            await inputCorrectPattern("test_user_1");
            await inputCorrectPattern("test_user_2");

            expect(
              getLastEventOf(firstRpsListener, "show-result")?.view,
            ).toEqual("show-result");
          },
        ));
    });

    describe("Timers", () => {
      it("should start show timer", () =>
        testFight(async ({ startGame, timer, firstRpsListener }) => {
          await startGame();
          expect(() => timer.getLastByName("show-timer")).not.toThrow();
          expect(
            getLastEventOf(firstRpsListener, "show-timer")?.data.secondsLeft,
          ).toBeGreaterThan(0);
        }));

      it("should show input timer when input starts", () =>
        testFight(async ({ startGame, timer, firstRpsListener }) => {
          await startGame();
          timer.getFirstByName("show-timer").emitTimeout();
          expect(() => timer.getLastByName("input-timer")).not.toThrow();
          await runAllMacroTasks();
          expect(
            getLastEventOf(firstRpsListener, "input-timer")?.data.secondsLeft,
          ).toBeGreaterThan(0);
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
    fight: lobbyHandler.getFight(fightId),
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
    state.fight!.game.disableRandom = disableRandom;
    await callers.test_user_1.lobby.ready();
    await callers.test_user_2.lobby.ready();
    await runAllMacroTasks();
    await runAllMacroTasks();
  };

  const clickCard = async (
    player: `test_user_${1 | 2}`,
    position: { row: number; col: number },
  ) => await callers[player].orderedMemory.clickCard(position);

  return {
    getFightId: () => state.fightId,
    getGame: () => state.fight!.game,
    getFight: () => state.fight!,
    startGame,
    clickCard,
    firstListener,
    firstRpsListener,
    secondListener,
    secondRpsListener,
    timer: getManualTimer(),
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
  };
}
