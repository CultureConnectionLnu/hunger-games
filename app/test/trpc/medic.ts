/* eslint-disable react-hooks/rules-of-hooks */
import { describe, expect, it, vi } from "vitest";
import { playerStateConfig } from "~/server/api/logic/config";
import {
  lobbyHandler,
  questHandler,
  type QuestKind,
} from "~/server/api/logic/handler";
import { gameStateHandler } from "~/server/api/logic/handler/game-state";
import {
  cleanupLeftovers,
  getManualTimer,
  getTestUserCallers,
  makeHubs,
  makeMedic,
  makePlayer,
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

    it("when player abandons a fight, he is wounded", () =>
      testFight(async ({ abandonGame, getWoundedPlayers }) => {
        await abandonGame();
        const wounded = await getWoundedPlayers();
        expect(wounded).toMatchObject([
          {
            userId: "test_user_1",
            isWounded: true,
          },
          {
            userId: "test_user_2",
            isWounded: true,
          },
        ]);
      }));

    it('time in seconds should be no bigger than the "maxReviveTimeInSeconds" config entry', () =>
      testFight(async ({ playGame, startRevive, getWoundedPlayers }) => {
        await playGame("test_user_1");
        await startRevive("test_user_2");
        const [first] = await getWoundedPlayers();
        expect(first?.initialTimeoutInSeconds).toBeLessThanOrEqual(
          playerStateConfig.reviveTimeInSeconds,
        );
        const allowedInaccuresyForTimeInSeconds = 3;
        expect(first?.initialTimeoutInSeconds).toBeGreaterThan(
          playerStateConfig.reviveTimeInSeconds -
            allowedInaccuresyForTimeInSeconds,
        );
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

      it("can't start reviving a player that was already stared to revive", () =>
        testFight(async ({ playGame, startRevive }) => {
          await playGame("test_user_1");
          await startRevive("test_user_2");
          await expect(async () =>
            startRevive("test_user_2"),
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
              // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
              initialTimeoutInSeconds: expect.any(Number),
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

    describe("moderator", () => {
      it("should show to moderator that player is wounded", () =>
        testFight(async ({ playGame, getQuestOfPlayer }) => {
          await playGame("test_user_1");
          const quest = await getQuestOfPlayer("test_user_2");

          expect(quest).toMatchObject({
            state: "player-is-wounded",
          });
        }));
    });

    describe("onWoundedUpdate", () => {
      it("should not emit an event on subscribe if player is not wounded", () =>
        testFight(async ({ onWoundedUpdateListener }) => {
          const listener = await onWoundedUpdateListener("test_user_1");
          expect(listener).not.toHaveBeenCalled();
        }));

      it("should emit an event on subscribe if player is wounded", () =>
        testFight(async ({ playGame, onWoundedUpdateListener }) => {
          await playGame("test_user_1");

          const listener = await onWoundedUpdateListener("test_user_2");

          expect(listener).toHaveBeenCalledTimes(1);
          expect(listener).toHaveBeenCalledWith({
            userId: "test_user_2",
            isWounded: true,
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
      args.getSubscriptions().forEach((x) => x());
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
    subscriptions: [] as (() => void)[],
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

  const abandonGame = async () => {
    const { id } = await callers.test_user_1.lobby.create({
      opponent: `test_user_2`,
    });
    state.allFightIds.push(id);
    getManualTimer().getFirstByName("start-timer").emitTimeout();
    await new Promise((resolve) =>
      lobbyHandler.getFight(id)!.game.on("destroy", resolve),
    );
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

  const getQuestOfPlayer = async (playerId: `test_user_${1 | 2}`) => {
    return callers.test_moderator_1.quest.getCurrentQuestOfPlayer({
      userId: playerId,
    });
  };

  const getWoundedPlayers = async () => {
    const wounded = await callers.test_medic.medic.getAllWounded();
    return wounded.filter((x) =>
      ["test_user_2", "test_user_1"].includes(x.userId),
    );
  };

  const startRevive = async (playerId: `test_user_${1 | 2}`) =>
    callers.test_medic.medic.startRevive({ playerId });

  const finishRevive = async (playerId: `test_user_${1 | 2}`) =>
    callers.test_medic.medic.finishRevive({ playerId });

  const waitForReviveTime = async () => {
    gameStateHandler.fakeTimePass();
  };

  const onWoundedUpdateListener = async (playerId: `test_user_${1 | 2}`) => {
    const listener = vi.fn();
    const subscription = (
      await callers.test_medic.medic.onWoundedUpdate({ playerId })
    ).subscribe({ next: listener });
    state.subscriptions.push(() => subscription.unsubscribe());
    return listener;
  };

  return {
    callers,
    playGame,
    abandonGame,
    startQuest,
    getAllFightIds: () => state.allFightIds,
    getAllQuestIds: () => state.allQuestIds,
    getSubscriptions: () => state.subscriptions,
    getWoundedPlayers,
    startRevive,
    finishRevive,
    waitForReviveTime,
    getQuestOfPlayer,
    onWoundedUpdateListener,
  };
}
