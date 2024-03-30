import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { TypedEventEmitter } from "~/lib/event-emitter";
import type { BaseGamePlayerEvents } from "~/server/api/logic/core/base-game-state";
import { FightHandler } from "~/server/api/logic/fight";
import { appRouter } from "~/server/api/root";
import type { RockPaperScissorsPlayerEvents } from "~/server/api/routers/games/rock-paper-scissors";
import { createCommonContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { fight } from "~/server/db/schema";
import {
  expectEventEmitted,
  getLastEventOf,
  getManualTimer,
  runAllMacroTasks,
  useAutomaticTimer,
  useManualTimer,
} from "./utils";
import test from "node:test";

export const rpsTests = () =>
  describe("Rock Paper Scissors", () => {
    describe("Evaluation", () => {
      it("should be a draw if no one chooses", () =>
        testFight(async ({ startGame, firstRpsListener, timer }) => {
          await startGame();

          timer.getFirstByName("choose-item").emitTimeout();

          expectEventEmitted(firstRpsListener, "show-result");
          const event = getLastEventOf(firstRpsListener, "show-result");
          expect(event?.data).toEqual({
            anotherRound: true,
            winner: [],
            looser: [],
            draw: true,
          });
        }));

      it("if only one player chooses, then he is the winner", () =>
        testFight(async ({ startGame, firstRpsListener, timer, choose }) => {
          await startGame();
          await choose("test_user_1", "rock");

          timer.getFirstByName("choose-item").emitTimeout();

          expectEventEmitted(firstRpsListener, "show-result");
          const event = getLastEventOf(firstRpsListener, "show-result");
          expect(event?.data).toEqual({
            anotherRound: true,
            winner: ["test_user_1"],
            looser: ["test_user_2"],
            draw: false,
          });
        }));

      it("if both player choose the same item, then it is a draw", () =>
        testFight(async ({ startGame, firstRpsListener, timer, choose }) => {
          await startGame();
          await choose("test_user_1", "rock");
          await choose("test_user_2", "rock");

          timer.getFirstByName("choose-item").emitTimeout();

          expectEventEmitted(firstRpsListener, "show-result");
          const event = getLastEventOf(firstRpsListener, "show-result");
          expect(event?.data).toEqual({
            anotherRound: true,
            winner: [],
            looser: [],
            draw: true,
          });
        }));

      (
        [
          {
            p1: "rock",
            p2: "scissors",
            winner: "test_user_1",
            looser: "test_user_2",
          },
          {
            p1: "scissors",
            p2: "paper",
            winner: "test_user_1",
            looser: "test_user_2",
          },
          {
            p1: "paper",
            p2: "rock",
            winner: "test_user_1",
            looser: "test_user_2",
          },
          {
            p1: "scissors",
            p2: "rock",
            winner: "test_user_2",
            looser: "test_user_1",
          },
          {
            p1: "paper",
            p2: "scissors",
            winner: "test_user_2",
            looser: "test_user_1",
          },
          {
            p1: "rock",
            p2: "paper",
            winner: "test_user_2",
            looser: "test_user_1",
          },
        ] satisfies Array<{
          p1: "rock" | "paper" | "scissors";
          p2: "rock" | "paper" | "scissors";
          winner: "test_user_1" | "test_user_2";
          looser: "test_user_1" | "test_user_2";
        }>
      ).forEach((x) => {
        it(`if player 1 chooses "${x.p1}" and player 2 chooses "${x.p2}", then ${x.winner} is the winner`, () =>
          testFight(async ({ startGame, firstRpsListener, choose }) => {
            await startGame();
            await choose("test_user_1", x.p1);
            await choose("test_user_2", x.p2);

            expectEventEmitted(firstRpsListener, "show-result");
            const event = getLastEventOf(firstRpsListener, "show-result");
            expect(event?.data).toEqual({
              anotherRound: true,
              winner: [x.winner],
              looser: [x.looser],
              draw: false,
            });
          }));
      });

      it("if a player wins 3 times, then he is the overall winner", () =>
        testFight(async ({ startGame, choose, timer, firstListener }) => {
          await startGame();
          await choose("test_user_1", "rock");
          await choose("test_user_2", "scissors");
          timer.getLastByName("next-round").emitTimeout();

          await choose("test_user_1", "rock");
          await choose("test_user_2", "scissors");
          timer.getLastByName("next-round").emitTimeout();

          await choose("test_user_1", "rock");
          await choose("test_user_2", "scissors");
          timer.getLastByName("next-round").emitTimeout();

          expectEventEmitted(firstListener, "game-ended");
          const event = getLastEventOf(firstListener, "game-ended");
          expect(event?.data).toEqual({
            winnerId: "test_user_1",
            looserId: "test_user_2",
          });
        }));
    });

    describe("Views", () => {
      it("should show choose view", () =>
        testFight(
          async ({ startGame, firstRpsListener, secondRpsListener }) => {
            await startGame();

            expect(
              getLastEventOf(firstRpsListener, "enable-choose")?.view,
            ).toEqual({
              general: "in-game",
              specific: "start-choose",
            });
            expect(
              getLastEventOf(secondRpsListener, "enable-choose")?.view,
            ).toEqual({
              general: "in-game",
              specific: "start-choose",
            });
          },
        ));

      it("should show chosen screen upon selection", () =>
        testFight(
          async ({
            startGame,
            firstRpsListener,
            choose,
            secondRpsListener,
          }) => {
            await startGame();
            await choose("test_user_1", "rock");

            expect(
              getLastEventOf(firstRpsListener, "show-waiting")?.view,
            ).toEqual({
              general: "in-game",
              specific: "chosen",
            });

            expect(
              getLastEventOf(secondRpsListener, "enable-choose")?.view,
            ).toEqual({
              general: "in-game",
              specific: "start-choose",
            });
          },
        ));

      it("should show result screen once all have chosen", () =>
        testFight(
          async ({
            startGame,
            firstRpsListener,
            choose,
            secondRpsListener,
          }) => {
            await startGame();
            await choose("test_user_1", "rock");
            await choose("test_user_2", "rock");

            expect(
              getLastEventOf(firstRpsListener, "show-result")?.view,
            ).toEqual({
              general: "in-game",
              specific: "show-result",
            });

            expect(
              getLastEventOf(secondRpsListener, "show-result")?.view,
            ).toEqual({
              general: "in-game",
              specific: "show-result",
            });
          },
        ));

      it("should show choose again after next round timer is done", () =>
        testFight(
          async ({
            startGame,
            choose,
            timer,
            firstRpsListener,
            secondRpsListener,
          }) => {
            await startGame();
            await choose("test_user_1", "rock");
            await choose("test_user_2", "rock");
            timer.getLastByName("next-round").emitTimeout();

            expect(
              getLastEventOf(firstRpsListener, "enable-choose")?.view,
            ).toEqual({
              general: "in-game",
              specific: "start-choose",
            });

            expect(
              getLastEventOf(secondRpsListener, "enable-choose")?.view,
            ).toEqual({
              general: "in-game",
              specific: "start-choose",
            });
          },
        ));
    });

    describe("Timers", () => {
      it("should start choose timer", () =>
        testFight(async ({ startGame, timer, firstRpsListener }) => {
          await startGame();

          expect(() => timer.getLastByName("choose-item")).not.toThrow();
          expect(
            getLastEventOf(firstRpsListener, "choose-timer")?.data.secondsLeft,
          ).toBeGreaterThan(0);
        }));

      it("should stop choose timer once everyone has chosen", () =>
        testFight(async ({ startGame, choose, timer, firstRpsListener }) => {
          await startGame();
          await choose("test_user_1", "rock");
          await choose("test_user_2", "rock");

          const chooseTimer = timer.getLastByName("choose-item");

          expect(chooseTimer.isCanceled).toBeTruthy();
          expect(
            getLastEventOf(firstRpsListener, "choose-timer")?.data.secondsLeft,
          ).toBe(0);
        }));

      it("should not start next round timer before everyone has chosen", () =>
        testFight(async ({ startGame, timer }) => {
          await startGame();

          expect(() => timer.getLastByName("next-round")).toThrow();
        }));

      it("should start next round timer once everyone has chosen", () =>
        testFight(async ({ startGame, choose, timer, firstRpsListener }) => {
          await startGame();
          await choose("test_user_1", "rock");
          await choose("test_user_2", "rock");

          expect(() => timer.getLastByName("next-round")).not.toThrow();
          expect(
            getLastEventOf(firstRpsListener, "next-round-timer")?.data
              .secondsLeft,
          ).toBeGreaterThan(0);
        }));

      it("should restart choose timer once next round timer is done", () =>
        testFight(async ({ startGame, choose, timer, firstRpsListener }) => {
          await startGame();
          await choose("test_user_1", "rock");
          await choose("test_user_2", "rock");

          const nextRoundTimer = timer.getLastByName("next-round");
          await timer.simulateNormalTimeout(nextRoundTimer);

          expect(timer.getLastByName("choose-item").isCanceled).toBeFalsy();
          expect(
            getLastEventOf(firstRpsListener, "next-round-timer")?.data
              .secondsLeft,
          ).toBe(0);
          expect(
            getLastEventOf(firstRpsListener, "choose-timer")?.data.secondsLeft,
          ).toBeGreaterThan(0);
        }));
    });
  });

async function testFight(
  test: (args: Awaited<ReturnType<typeof setupTest>>) => Promise<void>,
) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
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
      args.getGame().endGame("test_user_1");
      args.getGame().destroy();
      await db.delete(fight).where(eq(fight.id, id));
      return x;
    })
    .then(({ pass, error }) => {
      if (!pass) {
        throw error;
      }
    });
}

async function setupTest() {
  const callers = {
    test_user_1: appRouter.createCaller(
      await createCommonContext({
        ee: new TypedEventEmitter(),
        userId: "test_user_1",
      }),
    ),
    test_user_2: appRouter.createCaller(
      await createCommonContext({
        ee: new TypedEventEmitter(),
        userId: "test_user_2",
      }),
    ),
  } as const;

  const firstListener = vi.fn<[BaseGamePlayerEvents], void>();
  const secondListener = vi.fn<[BaseGamePlayerEvents], void>();
  const firstRpsListener = vi.fn<[RockPaperScissorsPlayerEvents], void>();
  const secondRpsListener = vi.fn<[RockPaperScissorsPlayerEvents], void>();
  FightHandler.instance.defineNextGameType("rock-paper-scissors");

  const { id: fightId } = await callers.test_user_1.fight.create({
    opponent: `test_user_2`,
  });

  await callers.test_user_1.fight.join();
  await callers.test_user_2.fight.join();

  const state = {
    fightId,
    game: FightHandler.instance.getGame(fightId),
    test_user_1: {
      base: (
        await callers.test_user_1.fight.onAction({
          userId: "test_user_1",
          fightId,
        })
      ).subscribe({ next: (event) => firstListener(event) }),
      rps: (
        await callers.test_user_1.rockPaperScissors.onAction({
          userId: "test_user_1",
          fightId,
        })
      ).subscribe({ next: (event) => firstRpsListener(event) }),
    },
    test_user_2: {
      base: (
        await callers.test_user_2.fight.onAction({
          userId: "test_user_2",
          fightId,
        })
      ).subscribe({ next: (event) => secondListener(event) }),
      rps: (
        await callers.test_user_2.rockPaperScissors.onAction({
          userId: "test_user_2",
          fightId,
        })
      ).subscribe({ next: (event) => secondRpsListener(event) }),
    },
  };

  const choose = async (
    player: "test_user_1" | "test_user_2",
    choice: "rock" | "paper" | "scissors",
  ) => {
    await callers[player].rockPaperScissors.choose(choice);
  };

  const startGame = async () => {
    await callers.test_user_1.fight.ready();
    await callers.test_user_2.fight.ready();
    await runAllMacroTasks();
    await runAllMacroTasks();
  };

  return {
    callers,
    getFightId: () => state.fightId,
    getGame: () => state.game!.instance,
    startGame,
    choose,
    firstListener,
    firstRpsListener,
    secondListener,
    secondRpsListener,
    timer: getManualTimer(),
  };
}
