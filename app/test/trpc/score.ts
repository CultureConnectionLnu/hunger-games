/* eslint-disable react-hooks/rules-of-hooks */
import { describe, expect, it } from "vitest";
import {
  fightScoringConfig,
  questScoringConfig,
} from "~/server/api/logic/config";
import {
  lobbyHandler,
  questHandler,
  type QuestKind,
} from "~/server/api/logic/handler";
import {
  cleanupLeftovers,
  getTestUserCallers,
  makeHubs,
  makePlayer,
  resetWoundedPlayers,
  useAutomaticTimer,
  useManualTimer,
} from "./utils";

const { registerHubHooks, getHubData } = makeHubs();
export const scoreTests = () =>
  describe("Score", () => {
    makePlayer("test_user_1");
    makePlayer("test_user_2");
    registerHubHooks();

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

      describe("fights", () => {
        it("should have one entry after one match for both player", () =>
          testFight(async ({ playGame, getHistory }) => {
            await playGame("test_user_1");
            const playerOneHistory = await getHistory("test_user_1");
            const playerTwoHistory = await getHistory("test_user_2");

            expect(playerOneHistory).toHaveLength(1);
            expect(playerTwoHistory).toHaveLength(1);
          }));

        it(`should score the very first winner with ${fightScoringConfig.winnerMinimumPointsBonus} points`, () =>
          testFight(async ({ playGame, getHistory }) => {
            await playGame("test_user_1");
            const [firstGame] = await getHistory("test_user_1");

            expect(firstGame?.score).toBe(
              fightScoringConfig.winnerMinimumPointsBonus,
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

      describe("quests", () => {
        Object.keys(questScoringConfig).forEach((kind) => {
          const questKind = kind as QuestKind;
          it(`should score ${questScoringConfig[questKind]} points for completing a ${questKind} quest`, () =>
            testFight(async ({ completeQuest, getHistory }) => {
              await completeQuest("test_user_1", questKind);

              const history = await getHistory("test_user_1");
              expect(history).toMatchObject([
                {
                  scoreChange: questScoringConfig[questKind],
                },
              ]);
            }));
        });

        it("should not have a history entry for uncompleted quests", () =>
          testFight(async ({ startQuest, getHistory }) => {
            await startQuest("test_user_1", "walk-1");

            const history = await getHistory("test_user_1");
            expect(history).toHaveLength(0);
          }));

        it("should not have a history entry for lost quests", () =>
          testFight(async ({ startQuest, playGame, getHistory }) => {
            await startQuest("test_user_1", "walk-1");
            await playGame("test_user_2");

            const history = await getHistory("test_user_1");
            // is 1, because the game is in the array
            expect(history).toHaveLength(1);
          }));
      });
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
  const args = await setupTest();
  // make sure that no scores for the player are present before the test
  return await test(args)
    .then(() => ({ pass: true, error: undefined }) as const)
    .catch((error: Error) => ({ pass: false, error }) as const)
    .then(async (x) => {
      useAutomaticTimer();
      await cleanupLeftovers({
        fightIds: args.getAllFightIds(),
        questIds: args.getAllQuestIds(),
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

  const state = {
    allFightIds: [] as string[],
    allQuestIds: [] as string[],
  };

  const playGame = async (winner: `test_user_${1 | 2}`) => {
    lobbyHandler.defineNextGameType("rock-paper-scissors");
    const { id } = await callers.test_user_1.lobby.create({
      opponent: `test_user_2`,
    });
    const looser = winner === "test_user_1" ? "test_user_2" : "test_user_1";
    const fight = lobbyHandler.getFight(id)!;
    fight.lobby.endGame(winner, looser);
    await fight.gameDone;
    state.allFightIds.push(id);
    await resetWoundedPlayers();
  };

  const startQuest = async (
    userId: `test_user_${1 | 2}`,
    questKind: QuestKind,
  ) => {
    questHandler.defineNextHubsUsedForWalkQuest(
      getHubData()
        // make sure that the current hub is not in the range for the test
        .filter((x) => x.assignedModeratorId !== "test_moderator_1")
        .map((x) => x.id)
        .filter(Boolean),
    );
    const newQuestId = await callers.test_moderator_1.quest.assignQuest({
      playerId: userId,
      questKind,
    });
    state.allQuestIds.push(newQuestId);
  };

  const completeQuest = async (
    userId: `test_user_${1 | 2}`,
    questKind: QuestKind,
  ) => {
    await startQuest(userId, questKind);
    await callers.test_moderator_2.quest.markHubAsVisited({
      playerId: userId,
    });
    if (questKind === "walk-1") return;
    await callers.test_moderator_3.quest.markHubAsVisited({
      playerId: userId,
    });
    if (questKind === "walk-2") return;
    await callers.test_moderator_4.quest.markHubAsVisited({
      playerId: userId,
    });
  };

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
    callers[userId].score.getHistory();

  const getHistoryEntry = (userId: `test_user_${1 | 2}`, fightId: string) =>
    callers[userId].score.historyEntry({ fightId });

  return {
    callers,
    playGame,
    completeQuest,
    startQuest,
    getAllFightIds: () => state.allFightIds,
    getAllQuestIds: () => state.allQuestIds,
    getDashboard,
    getHistory,
    getHistoryEntry,
    getUserFromDashboard,
  };
}
