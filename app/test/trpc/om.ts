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
      //   it("should be a draw if no one chooses", () =>
      //     testFight(async ({ startGame, firstRpsListener, timer }) => {
      //       await startGame();
      //       timer.getFirstByName("choose-timer").emitTimeout();
      //       expectEventEmitted(firstRpsListener, "show-result");
      //       const event = getLastEventOf(firstRpsListener, "show-result");
      //       expect(event?.data).toEqual({
      //         outcome: "draw",
      //         anotherRound: true,
      //         wins: 0,
      //         looses: 0,
      //         yourName: "Test User 1",
      //         opponentName: "Test User 2",
      //       });
      //     }));
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
        testFight(async ({ startGame, timer, clickCard, firstRpsListener }) => {
          await startGame();
          timer.getFirstByName("show-timer").emitTimeout();
          await clickCard("test_user_1", { row: 0, col: 0 });

          expect(
            getLastEventOf(firstRpsListener, "show-waiting")?.view,
          ).toEqual("wait-for-opponent");
        }));

      it('when both players have clicked on the correct card, then the view should change to "show-result"', () =>
        testFight(async ({ startGame, timer, clickCard, firstRpsListener }) => {
          await startGame();
          timer.getFirstByName("show-timer").emitTimeout();
          const toBeClicked = getLastEventOf(firstRpsListener, "show-pattern")!
            .data.pattern[0]!;
          await clickCard("test_user_1", toBeClicked);
          await clickCard("test_user_2", toBeClicked);

          expect(getLastEventOf(firstRpsListener, "show-result")?.view).toEqual(
            "show-result",
          );
        }));
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

  const startGame = async () => {
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
  };
}
