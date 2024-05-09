/* eslint-disable react-hooks/rules-of-hooks */
import { inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { lobbyHandler } from "~/server/api/logic/handler";
import { db } from "~/server/db";
import { fight } from "~/server/db/schema";
import {
  getTestUserCallers,
  makePlayer,
  useAutomaticTimer,
  useManualTimer,
} from "./utils";

export const questTests = () =>
  describe("Quest", () => {
    makePlayer("test_user_1");
    makePlayer("test_user_2");

    it("should be empty in the beginning", () =>
      testFight(async ({ getCurrentQuest }) => {
        expect(await getCurrentQuest("test_user_1")).toBeUndefined();
      }));
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

  const getAllFightIds = () => state.allFightIds;

  return {
    callers,
    playGame,
    getAllFightIds,
    getCurrentQuest,
  };
}
