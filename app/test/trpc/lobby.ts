import type { Unsubscribable } from "@trpc/server/observable";
import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import { TypedEventEmitter } from "~/lib/event-emitter";
import { FightHandler } from "~/server/api/logic/fight";

import type { BaseGamePlayerEvents } from "~/server/api/logic/core/base-game";
import type { TimerEvent } from "~/server/api/logic/core/timer";
import { appRouter } from "~/server/api/root";
import { createCommonContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { fight } from "~/server/db/schema";
import {
  expectEventEmitted,
  expectNotEvenEmitted,
  getLastEventOf,
  getManualTimer,
  runAllMacroTasks,
  useAutomaticTimer,
  useManualTimer,
} from "./utils";

export const lobbyTests = () =>
  describe("Lobby", () => {
    describe("currentFight", () => {
      it("should not find a match for current user", async () => {
        const ctx = await createCommonContext({
          ee: new TypedEventEmitter(),
          userId: "test_user_1",
        });
        const caller = appRouter.createCaller(ctx);

        const result = await caller.fight.currentFight(undefined);

        expect(result).toEqual({ success: false });
      });

      it("should find a match for current user", () =>
        testFight(async ({ createGame, callers }) => {
          await createGame();

          const result =
            await callers.test_user_1.fight.currentFight(undefined);
          expect(result).toHaveProperty("success", true);
        }));
    });

    describe("BaseGame", () => {
      describe("Before game start", () => {
        it("should emit that a player joined", () =>
          testFight(async ({ createGame, connect, firstListener }) => {
            await createGame();

            await connect("test_user_1");

            const event = getLastEventOf(
              firstListener,
              "player-joined-readying",
            )!;
            expect(event.data.joined).toContain("test_user_1");
          }));

        it("should emit that all players joined", () =>
          testFight(
            async ({ createGame, connect, firstListener, secondListener }) => {
              await createGame();

              await connect("test_user_1");
              await connect("test_user_2");

              expect(
                getLastEventOf(firstListener, "player-joined-readying")!.data
                  .joined,
              ).toEqual(["test_user_1", "test_user_2"]);
              expect(
                getLastEventOf(secondListener, "player-joined-readying")!.data
                  .joined,
              ).toEqual(["test_user_1", "test_user_2"]);
            },
          ));

        it("should emit that player is ready", () =>
          testFight(async ({ createGame, ready, connect, firstListener }) => {
            await createGame();

            await connect("test_user_1");
            await ready("test_user_1");

            const event = getLastEventOf(
              firstListener,
              "player-joined-readying",
            )!;
            expect(event.data.ready).toEqual(["test_user_1"]);
            expect(event.data.joined).toEqual([]);
          }));
      });

      it("should start the game", () =>
        testFight(async ({ startGame, firstListener }) => {
          await startGame();

          await runAllMacroTasks();

          expectEventEmitted(firstListener, "game-in-progress");
        }));

      it("should pause the game when a player disconnects", () =>
        testFight(
          async ({ startGame, disconnect, firstListener, secondListener }) => {
            await startGame();
            disconnect("test_user_1");

            expectEventEmitted(secondListener, "game-halted");
            expect(
              getLastEventOf(firstListener, "game-halted"),
            ).toBeUndefined();
          },
        ));

      it("should restart the game when a player reconnects", () =>
        testFight(
          async ({
            startGame,
            connect,
            disconnect,
            firstListener,
            secondListener,
          }) => {
            await startGame();
            disconnect("test_user_1");
            await connect("test_user_1");

            expectEventEmitted(secondListener, "game-resume");
            expectEventEmitted(firstListener, "game-resume");
          },
        ));

      it("should cleanup the game when destroyed", () =>
        testFight(async ({ startGame, getLobby }) => {
          await startGame();
          const lobby = getLobby();
          const fightId = lobby.fightId;

          lobby.destroy();
          await runAllMacroTasks();

          expect(FightHandler.instance.getFight(fightId)).toBeUndefined();
        }));

      describe("Timeout", () => {
        it("should end the game when no player joins", () =>
          testFight(async ({ createGame, getLobby, timer }) => {
            await createGame();
            const lobby = getLobby();
            const listener = vi.fn();
            lobby.on("canceled", listener);

            timer.getFirstByName("force-game-end").emitTimeout();

            expect(listener).toHaveBeenCalledWith({
              data: {
                reason: "force-stop",
              },
              fightId: lobby.fightId,
            });
          }));

        it("should cancel the game if only one player joins", () =>
          testFight(async ({ createGame, getLobby, connect, timer }) => {
            await createGame();
            const lobby = getLobby();
            const listener = vi.fn();
            lobby.on("canceled", listener);

            await connect("test_user_1");

            timer.getFirstByName("start-timer").emitTimeout();

            expect(listener).toHaveBeenCalledWith({
              data: {
                reason: "start-timeout",
              },
              fightId: lobby.fightId,
            });
          }));

        it("should cancel the game if only one player is ready", () =>
          testFight(async ({ createGame, getLobby, ready, connect, timer }) => {
            await createGame();

            const lobby = getLobby();
            const listener = vi.fn();
            lobby.on("canceled", listener);

            await connect("test_user_1");
            await ready("test_user_1");

            timer.getFirstByName("start-timer").emitTimeout();

            expect(listener).toHaveBeenCalledWith({
              data: {
                reason: "start-timeout",
              },
              fightId: lobby.fightId,
            });
          }));

        it("should cancel the game if someone disconnected before the game started", () =>
          testFight(
            async ({ createGame, getLobby, connect, disconnect, timer }) => {
              await createGame();
              const lobby = getLobby();
              const listener = vi.fn();
              lobby.on("canceled", listener);

              await connect("test_user_1");
              await connect("test_user_2");
              disconnect("test_user_1");

              timer.getFirstByName("start-timer").emitTimeout();

              expect(listener).toHaveBeenCalledWith({
                data: {
                  reason: "start-timeout",
                },
                fightId: lobby.fightId,
              });
            },
          ));

        it("should not start disconnected timer while the player did not mark as ready", () =>
          testFight(async ({ createGame, connect, timer, disconnect }) => {
            await createGame();
            await connect("test_user_1");

            disconnect("test_user_1");

            expect(() => timer.getFirstByName("disconnect-timer")).toThrow();
          }));

        it("should show disconnected timer when a player disconnects", () =>
          testFight(async ({ timer, startGame, disconnect }) => {
            await startGame();

            disconnect("test_user_2");

            expect(
              timer.getFirstByName("disconnect-timer").isCanceled,
            ).toBeFalsy();
          }));

        it("should no longer show disconnected timer when a player reconnects", () =>
          testFight(
            async ({
              timer,
              startGame,
              connect,
              disconnect,
              firstListener,
            }) => {
              await startGame();
              disconnect("test_user_2");

              await connect("test_user_2");

              expect(
                timer.getFirstByName("disconnect-timer").isCanceled,
              ).toBeTruthy();
              const disconnectTimerEvents = firstListener.mock.calls
                .map((x) => x[0])
                .filter((x) => x.event === "disconnect-timer")
                .map((x) => x.data as TimerEvent);

              // start and end
              expect(disconnectTimerEvents).toHaveLength(2);
              expect(disconnectTimerEvents[1]!.type).toBe("end");
            },
          ));

        it("should pause other timers when a player disconnects", () =>
          testFight(async ({ startGame, disconnect, timer }) => {
            await startGame();

            await new Promise((resolve) => setTimeout(resolve));
            disconnect("test_user_2");

            expect(timer.getLastByName("choose-timer").isRunning).toBeFalsy();
          }));

        it("should resume other timers when a player reconnects", () =>
          testFight(async ({ startGame, disconnect, connect, timer }) => {
            await startGame();

            await new Promise((resolve) => setTimeout(resolve));
            disconnect("test_user_2");
            await connect("test_user_2");

            expect(timer.getLastByName("choose-timer").isRunning).toBeTruthy();
          }));

        it("should end the game if a player is disconnected for to long", () =>
          testFight(async ({ startGame, disconnect, firstListener, timer }) => {
            await startGame();

            disconnect("test_user_2");
            timer.getFirstByName("disconnect-timer").emitTimeout();

            const winEvent = getLastEventOf(firstListener, "game-ended")!;
            expect(winEvent.data).toEqual({
              winnerId: "test_user_1",
              looserId: "test_user_2",
            });
          }));

        it("should end the game if all player are disconnected for to long", () =>
          testFight(
            async ({
              startGame,
              getLobby,
              disconnect,
              firstListener,
              timer,
            }) => {
              await startGame();
              const lobby = getLobby();
              const cancelListener = vi.fn();
              lobby.on("canceled", cancelListener);

              disconnect("test_user_2");
              disconnect("test_user_1");
              timer.getFirstByName("disconnect-timer").emitTimeout();

              expect(cancelListener).toHaveBeenLastCalledWith({
                data: {
                  reason: "disconnect-timeout",
                },
                fightId: lobby.fightId,
              });
              expectNotEvenEmitted(firstListener, "game-ended");
            },
          ));

        it("should allow multiple disconnects to happen", () =>
          testFight(async ({ startGame, disconnect, connect, timer }) => {
            await startGame();
            disconnect("test_user_2");
            await connect("test_user_2");

            disconnect("test_user_2");

            expect(
              timer.getLastByName("disconnect-timer").isCanceled,
            ).toBeFalsy();
          }));
      });
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
      args.getLobby().endGame("test_user_1");
      args.getFight().lobby.endGame("test_user_1");
      await args.getFight().gameDone;
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

  const state = {
    fightId: undefined as string | undefined,
    fight: undefined as ReturnType<FightHandler["getFight"]>,
    test_user_1: undefined as Unsubscribable | undefined,
    test_user_2: undefined as Unsubscribable | undefined,
  };

  const createGame = async () => {
    FightHandler.instance.defineNextGameType("rock-paper-scissors");

    const { id } = await callers.test_user_1.fight.create({
      opponent: `test_user_2`,
    });
    state.fightId = id;
    state.fight = FightHandler.instance.getFight(id)!;
  };

  const connect = async (userId: `test_user_${1 | 2}`) => {
    await callers[userId].fight.join();
    const listener = userId === "test_user_1" ? firstListener : secondListener;
    const un = (
      await callers[userId].fight.onGameAction({
        userId,
        fightId: state.fightId!,
      })
    ).subscribe({
      next: (event) => listener(event),
    });
    state[userId] = un;

    return un;
  };

  const disconnect = (userId: `test_user_${1 | 2}`) => {
    state[userId]?.unsubscribe();
    state[userId] = undefined;
  };

  const ready = async (userId: `test_user_${1 | 2}`) => {
    return callers[userId].fight.ready();
  };

  const startGame = async () => {
    await createGame();
    await connect("test_user_1");
    await connect("test_user_2");
    await ready("test_user_1");
    await ready("test_user_2");
  };

  return {
    callers,
    getFightId: () => state.fightId,
    getLobby: () => state.fight!.lobby,
    getFight: () => state.fight!,
    createGame,
    connect,
    disconnect,
    ready,
    startGame,
    timer: getManualTimer(),
    firstListener,
    secondListener,
  };
}
