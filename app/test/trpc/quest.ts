/* eslint-disable react-hooks/rules-of-hooks */
import { describe, expect, it } from "vitest";
import { lobbyHandler, questHandler } from "~/server/api/logic/handler";
import { type RouterOutputs } from "~/trpc/shared";
import {
  cleanupLeftovers,
  getTestUserCallers,
  makeHubs,
  makePlayer,
  useAutomaticTimer,
  useManualTimer,
  type ModeratorIds,
} from "./utils";

type QuestData = NonNullable<RouterOutputs["quest"]["getCurrentQuestOfPlayer"]>;
type GetQuestKind<T> = T extends { quest: { kind: infer U } } ? U : never;
type QuestKind = GetQuestKind<QuestData>;

const { registerHubHooks, getHubData } = makeHubs();

export const questTests = () =>
  describe("Quest", () => {
    makePlayer("test_user_1");
    makePlayer("test_user_2");
    registerHubHooks();

    it("by default, player should not have a quest assigned", () =>
      testQuest(async ({ player }) => {
        expect(await player.getCurrentQuest("test_user_1")).toBeUndefined();
      }));

    it("player should have a quest after assigning a quest", () =>
      testQuest(async ({ player, moderator }) => {
        await moderator.assignQuest(
          "test_moderator_1",
          "test_user_1",
          "walk-1",
        );

        const quest = await player.getCurrentQuest("test_user_1");

        expect(quest).toMatchObject({ kind: "walk-1" });
      }));

    it("walk-1 quest should have one hub as destination", () =>
      testQuest(async ({ player, moderator }) => {
        await moderator.assignQuest(
          "test_moderator_1",
          "test_user_1",
          "walk-1",
        );

        const quest = await player.getCurrentQuest("test_user_1");

        expect(quest?.additionalInformation).toMatchObject([
          { name: "Test Hub 2" },
        ]);
      }));

    it("walk-2 quest should have one hub as destination", () =>
      testQuest(async ({ player, moderator }) => {
        await moderator.assignQuest(
          "test_moderator_1",
          "test_user_1",
          "walk-2",
        );

        const quest = await player.getCurrentQuest("test_user_1");

        expect(quest?.additionalInformation).toMatchObject([
          { name: "Test Hub 2" },
          { name: "Test Hub 3" },
        ]);
      }));

    it("walk-3 quest should have one hub as destination", () =>
      testQuest(async ({ player, moderator }) => {
        await moderator.assignQuest(
          "test_moderator_1",
          "test_user_1",
          "walk-3",
        );

        const quest = await player.getCurrentQuest("test_user_1");

        expect(quest?.additionalInformation).toMatchObject([
          { name: "Test Hub 2" },
          { name: "Test Hub 3" },
          { name: "Test Hub 4" },
        ]);
      }));

    describe("player", () => {
      it("should loose a quest upon loosing a fight", () =>
        testQuest(async ({ player, moderator, playGame }) => {
          await moderator.assignQuest(
            "test_moderator_1",
            "test_user_1",
            "walk-1",
          );
          await playGame("test_user_2");

          const quest = await player.getCurrentQuest("test_user_1");
          expect(quest).toBeUndefined();
        }));

      it("should keep quest upon winning a fight", () =>
        testQuest(async ({ player, moderator, playGame }) => {
          await moderator.assignQuest(
            "test_moderator_1",
            "test_user_1",
            "walk-1",
          );
          await playGame("test_user_1");

          const quest = await player.getCurrentQuest("test_user_1");
          expect(quest).not.toBeUndefined();
        }));

      describe("history", () => {
        it("by default, should be empty", () =>
          testQuest(async ({ player }) => {
            const history = await player.getHistory("test_user_1");

            expect(history).toHaveLength(0);
          }));

        it("should show an ongoing quest in history", () =>
          testQuest(async ({ player, moderator }) => {
            await moderator.assignQuest(
              "test_moderator_1",
              "test_user_1",
              "walk-1",
            );

            const history = await player.getHistory("test_user_1");
            expect(history).toMatchObject([
              {
                outcome: null,
                kind: "walk-1",
              },
            ]);
          }));

        it("should show completed quest in history", () =>
          testQuest(async ({ player, moderator }) => {
            await moderator.assignQuest(
              "test_moderator_1",
              "test_user_1",
              "walk-1",
            );
            await moderator.markAsVisited("test_moderator_2", "test_user_1");

            const history = await player.getHistory("test_user_1");
            expect(history).toMatchObject([
              {
                outcome: "completed",
                kind: "walk-1",
              },
            ]);
          }));

        it("should show lost quest in history", () =>
          testQuest(async ({ player, moderator, playGame }) => {
            await moderator.assignQuest(
              "test_moderator_1",
              "test_user_1",
              "walk-1",
            );
            await playGame("test_user_2");

            const history = await player.getHistory("test_user_1");
            expect(history).toMatchObject([
              {
                outcome: "lost-in-battle",
                kind: "walk-1",
              },
            ]);
          }));
      });
    });

    describe("moderator", () => {
      it("see that the player has no quest", () =>
        testQuest(async ({ moderator }) => {
          const quest = await moderator.getQuestOfPlayer(
            "test_moderator_1",
            "test_user_1",
          );

          expect(quest).toMatchObject({ state: "no-active-quest" });
        }));

      it("can't assign a quest to a user that already has an ongoing quest", () =>
        testQuest(async ({ moderator }) => {
          await moderator.assignQuest(
            "test_moderator_1",
            "test_user_1",
            "walk-1",
          );

          await expect(async () =>
            moderator.assignQuest("test_moderator_2", "test_user_1", "walk-2"),
          ).rejects.toThrow();
        }));

      it("a moderator that is not involved with the quest should be marked as such", () =>
        testQuest(async ({ moderator }) => {
          await moderator.assignQuest(
            "test_moderator_1",
            "test_user_1",
            "walk-1",
          );

          const quest = await moderator.getQuestOfPlayer(
            "test_moderator_3",
            "test_user_1",
          );

          expect(quest).toMatchObject({
            state: "quest-does-not-concern-this-hub",
          });
        }));

      it("a moderator that is part of the destinations should be marked as such", () =>
        testQuest(async ({ moderator }) => {
          await moderator.assignQuest(
            "test_moderator_1",
            "test_user_1",
            "walk-1",
          );

          const quest = await moderator.getQuestOfPlayer(
            "test_moderator_2",
            "test_user_1",
          );

          expect(quest).toMatchObject({
            state: "quest-for-this-hub",
          });
        }));

      it("see that the player is in a fight right now", () =>
        testQuest(async ({ startGame, moderator }) => {
          await startGame();

          const quest = await moderator.getQuestOfPlayer(
            "test_moderator_1",
            "test_user_1",
          );

          expect(quest).toMatchObject({ state: "player-in-fight" });
        }));

      describe("visited", () => {
        it("by default, should show that the hub was not yet visited", () =>
          testQuest(async ({ moderator }) => {
            await moderator.assignQuest(
              "test_moderator_1",
              "test_user_1",
              "walk-2",
            );

            const quest = await moderator.getQuestOfPlayer(
              "test_moderator_2",
              "test_user_1",
            );

            expect(quest).toMatchObject({
              currentHubVisited: false,
            });
          }));

        it("should mark hub as visited when moderator approves visit", () =>
          testQuest(async ({ moderator }) => {
            await moderator.assignQuest(
              "test_moderator_1",
              "test_user_1",
              "walk-2",
            );

            await moderator.markAsVisited("test_moderator_2", "test_user_1");

            const quest = await moderator.getQuestOfPlayer(
              "test_moderator_2",
              "test_user_1",
            );
            expect(quest).toMatchObject({
              currentHubVisited: true,
            });
          }));
      });

      describe("completing", () => {
        it("should mark a walk-1 quest as completed, when all hubs are visited", () =>
          testQuest(async ({ player, moderator }) => {
            await moderator.assignQuest(
              "test_moderator_1",
              "test_user_1",
              "walk-1",
            );
            await moderator.markAsVisited("test_moderator_2", "test_user_1");

            const quest = await player.getCurrentQuest("test_user_1");

            expect(quest).toBeUndefined();
          }));

        it("should mark a walk-2 quest as completed, when all hubs are visited", () =>
          testQuest(async ({ player, moderator }) => {
            await moderator.assignQuest(
              "test_moderator_1",
              "test_user_1",
              "walk-2",
            );
            await moderator.markAsVisited("test_moderator_2", "test_user_1");
            await moderator.markAsVisited("test_moderator_3", "test_user_1");

            const quest = await player.getCurrentQuest("test_user_1");

            expect(quest).toBeUndefined();
          }));

        it("should mark a walk-3 quest as completed, when all hubs are visited", () =>
          testQuest(async ({ player, moderator }) => {
            await moderator.assignQuest(
              "test_moderator_1",
              "test_user_1",
              "walk-3",
            );
            await moderator.markAsVisited("test_moderator_2", "test_user_1");
            await moderator.markAsVisited("test_moderator_3", "test_user_1");
            await moderator.markAsVisited("test_moderator_4", "test_user_1");

            const quest = await player.getCurrentQuest("test_user_1");

            expect(quest).toBeUndefined();
          }));
      });
    });
  });

async function testQuest(
  test: (args: Awaited<ReturnType<typeof setupTest>>) => Promise<void>,
) {
  useManualTimer();
  const args = await setupTest();

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

  const startGame = async () => {
    const { id } = await callers.test_user_1.lobby.create({
      opponent: `test_user_2`,
    });
    state.allFightIds.push(id);
    return id;
  };

  const playGame = async (winner: `test_user_${1 | 2}`) => {
    const id = await startGame();
    const looser = winner === "test_user_1" ? "test_user_2" : "test_user_1";
    const fight = lobbyHandler.getFight(id)!;
    fight.lobby.endGame(winner, looser);
    await fight.gameDone;
  };

  const getCurrentQuest = async (player: `test_user_${1 | 2}`) => {
    return callers[player].quest.getCurrentQuestForPlayer();
  };
  const getHistory = async (player: `test_user_${1 | 2}`) => {
    return callers[player].quest.getAllQuestsFromPlayer();
  };

  const assignQuest = async (
    moderatorId: ModeratorIds,
    playerId: `test_user_${1 | 2}`,
    questKind: QuestKind,
  ) => {
    questHandler.defineNextHubsUsedForWalkQuest(
      getHubData()
        // make sure that the current hub is not in the range for the test
        .filter((x) => x.assignedModeratorId !== moderatorId)
        .map((x) => x.id)
        .filter(Boolean),
    );
    const newQuestId = await callers[moderatorId].quest.assignQuest({
      questKind,
      playerId,
    });
    state.allQuestIds.push(newQuestId);
  };

  const getQuestOfPlayer = async (
    moderatorId: ModeratorIds,
    playerId: `test_user_${1 | 2}`,
  ) => {
    return callers[moderatorId].quest.getCurrentQuestOfPlayer({
      userId: playerId,
    });
  };

  const markAsVisited = async (
    moderatorId: ModeratorIds,
    playerId: `test_user_${1 | 2}`,
  ) => {
    return callers[moderatorId].quest.markHubAsVisited({ playerId });
  };

  return {
    callers,
    playGame,
    startGame,
    getAllFightIds: () => state.allFightIds,
    getAllQuestIds: () => state.allQuestIds,
    player: {
      getCurrentQuest,
      getHistory,
    },
    moderator: {
      assignQuest,
      getQuestOfPlayer,
      markAsVisited,
    },
  };
}
