/* eslint-disable react-hooks/rules-of-hooks */
import { inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { TypedEventEmitter } from "~/lib/event-emitter";
import { FightHandler } from "~/server/api/logic/fight";
import { staticScoringConfig } from "~/server/api/logic/score";
import { appRouter } from "~/server/api/root";
import { createCommonContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { fight } from "~/server/db/schema";
import {
  makePlayer,
  useAutomaticTimer,
  useManualTimer,
  useMockUserNames,
  useRealUserNames,
} from "./utils";

export const scoreTests = () =>
  describe("Score", () => {
    makePlayer("test_user_1");
    makePlayer("test_user_2");

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

    describe("history", () => {
      it("should have no entries in history", () =>
        testFight(async ({ getHistory }) => {
          const history = await getHistory("test_user_1");

          expect(history).toHaveLength(0);
        }));

      it("should have one entry after one match for both player", () =>
        testFight(async ({ playGame, getHistory }) => {
          await playGame("test_user_1");
          const playerOneHistory = await getHistory("test_user_1");
          const playerTwoHistory = await getHistory("test_user_2");

          expect(playerOneHistory).toHaveLength(1);
          expect(playerTwoHistory).toHaveLength(1);
        }));

      it(`should score the very first winner with ${staticScoringConfig.winnerMinimumPointsBonus} points`, () =>
        testFight(async ({ playGame, getHistory }) => {
          await playGame("test_user_1");
          const [firstGame] = await getHistory("test_user_1");

          expect(firstGame?.score).toBe(
            staticScoringConfig.winnerMinimumPointsBonus,
          );
        }));

      it(`should score the very first looser with 0 points`, () =>
        testFight(async ({ playGame, getHistory }) => {
          await playGame("test_user_1");
          const [firstGame] = await getHistory("test_user_2");

          expect(firstGame?.score).toBe(0);
        }));

      it(`should show all games`, () =>
        testFight(async ({ playGame, getHistory }) => {
          await playGame("test_user_1");
          await playGame("test_user_1");
          await playGame("test_user_1");
          const history = await getHistory("test_user_1");

          expect(history).toHaveLength(3);
        }));
    });

    describe("historyEntry", () => {
      it("should return the correct history entry", () =>
        testFight(async ({ playGame, getHistoryEntry, getAllFightIds }) => {
          await playGame("test_user_1");
          const [fight] = getAllFightIds();
          const entry = await getHistoryEntry("test_user_1", fight!);

          expect(entry).toEqual({
            winnerScore: 100,
            looserScore: 0,
            youWon: true,
            game: "rock-paper-scissors",
            winnerName: "Test User 1",
            looserName: "Test User 2",
          });
        }));
    });
  });

async function testFight(
  test: (args: Awaited<ReturnType<typeof setupTest>>) => Promise<void>,
) {
  useManualTimer();
  useMockUserNames();
  const args = await setupTest();
  // make sure that no scores for the player are present before the test
  return await test(args)
    .then(() => ({ pass: true, error: undefined }) as const)
    .catch((error: Error) => ({ pass: false, error }) as const)
    .then(async (x) => {
      useAutomaticTimer();
      useRealUserNames();
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
    const looser = winner === "test_user_1" ? "test_user_2" : "test_user_1";
    const fight = FightHandler.instance.getFight(id)!;
    fight.lobby.endGame(winner, looser);
    await fight.gameDone;
    state.allFightIds.push(id);
  };

  const getAllFightIds = () => state.allFightIds;

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

  const getHistory = (userId: `test_user_${1 | 2}`) =>
    callers[userId].score.history();

  const getHistoryEntry = (userId: `test_user_${1 | 2}`, fightId: string) =>
    callers[userId].score.historyEntry({ fightId });

  return {
    callers,
    playGame,
    getAllFightIds,
    getDashboard,
    getHistory,
    getHistoryEntry,
    getUserFromDashboard,
  };
}
