import { inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { TypedEventEmitter } from "~/lib/event-emitter";
import { FightHandler } from "~/server/api/logic/fight";
import { appRouter } from "~/server/api/root";
import { createCommonContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { fight } from "~/server/db/schema";
import { useAutomaticTimer, useManualTimer } from "./utils";
import { staticScoringConfig } from "~/server/api/logic/score";
import { randomUUID } from "crypto";

export const scoreTests = () =>
  describe("Score", () => {
    describe("currentScore", () => {
      it("initially score is 0", () =>
        testFight(async ({ getScoreOfUser }) => {
          const score1 = await getScoreOfUser("test_user_1");
          const score2 = await getScoreOfUser("test_user_2");
          expect(score1).toEqual({ score: 0 });
          expect(score2).toEqual({ score: 0 });
        }));

      it(`winner gets at least ${staticScoringConfig.winnerMinimumPointsBonus} points`, () =>
        testFight(async ({ playGame, getScoreOfUser }) => {
          await playGame("test_user_1");
          const score1 = await getScoreOfUser("test_user_1");
          const score2 = await getScoreOfUser("test_user_2");
          expect(score1).toEqual({
            score: staticScoringConfig.winnerMinimumPointsBonus,
          });
          expect(score2).toEqual({ score: 0 });
        }));

      it(`looser should loose ${staticScoringConfig.winnerGetsPercent}% of his points`, () =>
        testFight(async ({ playGame, getScoreOfUser }) => {
          await playGame("test_user_1");
          await playGame("test_user_2");
          const score1 = await getScoreOfUser("test_user_1");
          const score2 = await getScoreOfUser("test_user_2");
          expect(score1).toEqual({ score: 50 });
          expect(score2).toEqual({ score: 100 });
        }));
    });

    describe("dashboard", () => {
      it("should be empty in the beginning", () =>
        testFight(async ({ getDashboard }) => {
          const board = await getDashboard();
          expect(board).toEqual([]);
        }));

      it("winner should be ahead of looser in the dashboard", () =>
        testFight(async ({ playGame, getUserFromDashboard }) => {
          await playGame("test_user_1");
          const user1 = await getUserFromDashboard("test_user_1");
          const user2 = await getUserFromDashboard("test_user_2");
          expect(user1?.rank).toBeLessThan(user2!.rank);
        }));

      it("the dashboard order changes after a game", () =>
        testFight(async ({ playGame, getUserFromDashboard }) => {
          await playGame("test_user_1");
          await playGame("test_user_2");

          const user1 = await getUserFromDashboard("test_user_1");
          const user2 = await getUserFromDashboard("test_user_2");

          expect(user1?.rank).toBeGreaterThan(user2!.rank);
        }));
    });

    describe("scoreFromGame", () => {
      it("should return the score from a specific game", () =>
        testFight(async ({ getAllFightIds, playGame, getScoreFromGame }) => {
          await playGame("test_user_1");
          const fightId = getAllFightIds()[0]!;
          const score = await getScoreFromGame(fightId, "test_user_1");
          expect(score).toEqual(100);
        }));
    });
  });

async function testFight(
  test: (args: Awaited<ReturnType<typeof setupTest>>) => Promise<void>,
) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useManualTimer();
  const args = await setupTest();
  // make sure that no scores for the player are present before the test
  return await test(args)
    .then(() => ({ pass: true, error: undefined }) as const)
    .catch((error: Error) => ({ pass: false, error }) as const)
    .then(async (x) => {
      useAutomaticTimer();
      if (args.getAllFightIds().length !== 0) {
        await db.delete(fight).where(inArray(fight.id, args.getAllFightIds()));
      }
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

  const state = {
    allFightIds: [] as string[],
  };

  const playGame = async (winner: `test_user_${1 | 2}`) => {
    const { id } = await callers.test_user_1.fight.create({
      opponent: `test_user_2`,
    });
    const fight = FightHandler.instance.getFight(id)!;
    fight.lobby.endGame(winner);
    await fight.gameDone;
    state.allFightIds.push(id);
  };

  const getAllFightIds = () => state.allFightIds;

  const getScoreOfUser = (userId: `test_user_${1 | 2}`) =>
    callers[userId].score.currentScore();

  const getDashboard = async () => {
    const board = await callers.test_user_1.score.dashboard();
    return board.filter(
      (x) => x.userId === "test_user_1" || x.userId === "test_user_2",
    );
  };

  const getUserFromDashboard = async (userId: `test_user_${1 | 2}`) => {
    const board = await getDashboard();
    return board.find((x) => x.userId === userId);
  };

  const getScoreFromGame = (fightId: string, userId: `test_user_${1 | 2}`) =>
    callers[userId].score.scoreFromGame({ fightId, userId });

  return {
    callers,
    playGame,
    getAllFightIds,
    getScoreOfUser,
    getDashboard,
    getUserFromDashboard,
    getScoreFromGame,
  };
}
