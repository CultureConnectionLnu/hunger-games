/* eslint-disable react-hooks/rules-of-hooks */
import { inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  type QuestKind,
  lobbyHandler,
  questHandler,
} from "~/server/api/logic/handler";
import { gameStateHandler } from "~/server/api/logic/handler/game-state";
import { db } from "~/server/db";
import { fight } from "~/server/db/schema";
import {
  cleanupLeftovers,
  getTestUserCallers,
  makeHubs,
  makeMedic,
  makePlayer,
  resetWoundedPlayers,
  useAutomaticTimer,
  useManualTimer,
} from "./utils";

const { registerHubHooks, getHubData } = makeHubs();
export const medicTests = () =>
  describe("Medic", () => {
    makePlayer("test_user_1");
    makePlayer("test_user_2");
    makeMedic("test_medic");
    registerHubHooks();

    it("initially no one is wounded", () =>
      testFight(async ({ getWoundedPlayers }) => {
        const wounded = await getWoundedPlayers();
        expect(wounded).toHaveLength(0);
      }));

    it("when player lost, he is wounded", () =>
      testFight(async ({ playGame, getWoundedPlayers }) => {
        await playGame("test_user_1");
        const wounded = await getWoundedPlayers();
        expect(wounded).toMatchObject([
          {
            userId: "test_user_2",
            isWounded: true,
          },
        ]);
      }));

    describe("startRevive", () => {
      it("can't start reviving a non player", () =>
        testFight(async ({ startRevive }) => {
          await expect(async () =>
            // @ts-expect-error this is not a player, but this is expected here
            startRevive("test_admin"),
          ).rejects.toThrow();
        }));

      it("can't start reviving a player that is not wounded", () =>
        testFight(async ({ startRevive }) => {
          await expect(async () =>
            startRevive("test_user_1"),
          ).rejects.toThrow();
        }));

      it("should start revival process", () =>
        testFight(async ({ playGame, getWoundedPlayers, startRevive }) => {
          await playGame("test_user_1");
          await startRevive("test_user_2");
          const wounded = await getWoundedPlayers();
          expect(wounded).toMatchObject([
            {
              userId: "test_user_2",
              isWounded: true,
              reviveCoolDownEnd: expect.any(Date),
            },
          ]);
        }));
    });

    describe("finishRevive", () => {
      it("can't finish revival of a non player", () =>
        testFight(async ({ finishRevive }) => {
          await expect(async () =>
            // @ts-expect-error this is not a player, but this is expected here
            finishRevive("test_admin"),
          ).rejects.toThrow();
        }));

      it("can't finish revival of a non wounded player", () =>
        testFight(async ({ finishRevive }) => {
          await expect(async () =>
            finishRevive("test_user_1"),
          ).rejects.toThrow();
        }));

      it("can't finish revival before starting it", () =>
        testFight(async ({ playGame, finishRevive }) => {
          await playGame("test_user_1");

          await expect(async () =>
            finishRevive("test_user_2"),
          ).rejects.toThrow();
        }));

      it("can't finish revival before waiting time is up", () =>
        testFight(async ({ playGame, startRevive, finishRevive }) => {
          await playGame("test_user_1");
          await startRevive("test_user_2");

          await expect(async () =>
            finishRevive("test_user_2"),
          ).rejects.toThrow();
        }));

      it("should finish revival after waiting for timeout", () =>
        testFight(
          async ({
            playGame,
            startRevive,
            finishRevive,
            waitForReviveTime,
            getWoundedPlayers,
          }) => {
            await playGame("test_user_1");
            await startRevive("test_user_2");
            await waitForReviveTime();

            await finishRevive("test_user_2");

            const wounded = await getWoundedPlayers();
            expect(wounded).toHaveLength(0);
          },
        ));
    });

    describe("wounded player", () => {
      it("can't start another fight when wounded", () =>
        testFight(async ({ playGame }) => {
          await playGame("test_user_1");
          await expect(() => playGame("test_user_1")).rejects.toThrow();
        }));

      it("can't start another quest when wounded", () =>
        testFight(async ({ playGame, startQuest }) => {
          await playGame("test_user_1");
          await expect(() =>
            startQuest("test_user_2", "walk-1"),
          ).rejects.toThrow();
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
    const { id } = await callers.test_user_1.lobby.create({
      opponent: `test_user_2`,
    });
    const looser = winner === "test_user_1" ? "test_user_2" : "test_user_1";
    const fight = lobbyHandler.getFight(id)!;
    fight.lobby.endGame(winner, looser);
    await fight.gameDone;
    state.allFightIds.push(id);
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
    const id = await callers.test_moderator_1.quest.assignQuest({
      playerId: userId,
      questKind,
    });
    state.allQuestIds.push(id);
  };

  const getWoundedPlayers = async () =>
    callers.test_medic.medic.getAllWounded();

  const startRevive = async (playerId: `test_user_${1 | 2}`) =>
    callers.test_medic.medic.startRevive({ playerId });

  const finishRevive = async (playerId: `test_user_${1 | 2}`) =>
    callers.test_medic.medic.finishRevive({ playerId });

  const waitForReviveTime = async () => {
    gameStateHandler.fakeTimePass();
  };

  return {
    callers,
    playGame,
    startQuest,
    getAllFightIds: () => state.allFightIds,
    getAllQuestIds: () => state.allQuestIds,
    getWoundedPlayers,
    startRevive,
    finishRevive,
    waitForReviveTime,
  };
}
