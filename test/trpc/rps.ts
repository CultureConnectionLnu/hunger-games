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

export const rpsTests = () =>
  describe("Rock Paper Scissors", () => {
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
