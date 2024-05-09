/* eslint-disable react-hooks/rules-of-hooks */
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lobbyHandler } from "~/server/api/logic/handler";
import { db } from "~/server/db";
import { fight } from "~/server/db/schema";
import {
  type MockUserIds,
  getTestUserCallers,
  makePlayer,
  useAutomaticTimer,
  useManualTimer,
} from "./utils";
import { type RouterOutputs, type RouterInputs } from "~/trpc/shared";

type QuestData = NonNullable<RouterOutputs["quest"]["getCurrentQuestOfPlayer"]>;
type GetQuestKind<T> = T extends { quest: { kind: infer U } } ? U : never;
type QuestKind = GetQuestKind<QuestData>;

type AddHub = RouterInputs["hub"]["addHub"];
type TestHubs = Omit<AddHub, "assignedModeratorId"> & {
  assignedModeratorId: MockUserIds;
};
const testHubs = [
  {
    name: "Test Hub 1",
    assignedModeratorId: "test_moderator_1",
  },
  {
    name: "Test Hub 2",
    assignedModeratorId: "test_moderator_2",
  },
  {
    name: "Test Hub 3",
    assignedModeratorId: "test_moderator_3",
  },
  {
    name: "Test Hub 4",
    assignedModeratorId: "test_moderator_4",
  },
] satisfies TestHubs[];

export const questTests = () =>
  describe("Quest", () => {
    makePlayer("test_user_1");
    makePlayer("test_user_2");

    beforeAll(async () => {
      const callers = await getTestUserCallers();
      for (const hub of testHubs) {
        await callers.test_admin.hub.addHub(hub);
      }
    });

    afterAll(async () => {
      const callers = await getTestUserCallers();
      const hubs = await callers.test_admin.hub.allHubs();
      const moderatorIds = new Set(testHubs.map((x) => x.assignedModeratorId));
      for (const hub of hubs) {
        if (
          !hub.assignedModerator ||
          !moderatorIds.has(hub.assignedModerator.id)
        )
          continue;
        await callers.test_admin.hub.removeHub({ hubId: hub.id });
      }
    });

    it("by default, player should not have a quest assigned", () =>
      testQuest(async ({ getCurrentQuest }) => {
        expect(await getCurrentQuest("test_user_1")).toBeUndefined();
      }));

    it("player should have a quest after assigning a quest", () =>
      testQuest(async ({ assignQuest, getCurrentQuest }) => {
        await assignQuest("test_moderator_1", "test_user_1", "walk-1");

        const quest = await getCurrentQuest("test_user_1");

        expect(quest).toMatchObject({ kind: "walk-1" });
      }));

    it("walk-1 quest should have one hub as destination", () =>
      testQuest(async ({ assignQuest, getCurrentQuest }) => {
        await assignQuest("test_moderator_1", "test_user_1", "walk-1");

        const quest = await getCurrentQuest("test_user_1");

        expect(quest?.additionalInformation).toHaveLength(1);
      }));

    it("walk-2 quest should have one hub as destination", () =>
      testQuest(async ({ assignQuest, getCurrentQuest }) => {
        await assignQuest("test_moderator_1", "test_user_1", "walk-2");

        const quest = await getCurrentQuest("test_user_1");

        expect(quest?.additionalInformation).toHaveLength(1);
      }));

    it("walk-3 quest should have one hub as destination", () =>
      testQuest(async ({ assignQuest, getCurrentQuest }) => {
        await assignQuest("test_moderator_1", "test_user_1", "walk-3");

        const quest = await getCurrentQuest("test_user_1");

        expect(quest?.additionalInformation).toHaveLength(1);
      }));
  });

async function testQuest(
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
  const callers = await getTestUserCallers();

  const state = {
    allFightIds: [] as string[],
  };

  const playGame = async (winner: `test_user_${1 | 2}`) => {
    const { id } = await callers.test_user_1.fight.create({
      opponent: `test_user_2`,
    });
    const looser = winner === "test_user_1" ? "test_user_2" : "test_user_1";
    const fight = lobbyHandler.getFight(id)!;
    fight.lobby.endGame(winner, looser);
    await fight.gameDone;
    state.allFightIds.push(id);
  };

  const getCurrentQuest = async (player: `test_user_${1 | 2}`) => {
    return callers[player].quest.getCurrentQuestForPlayer();
  };

  const assignQuest = async (
    moderatorId: (typeof testHubs)[number]["assignedModeratorId"],
    playerId: `test_user_${1 | 2}`,
    questKind: QuestKind,
  ) => {
    await callers[moderatorId].quest.assignQuest({ questKind, playerId });
  };

  const getAllFightIds = () => state.allFightIds;

  return {
    callers,
    playGame,
    getAllFightIds,
    getCurrentQuest,
    assignQuest,
  };
}
