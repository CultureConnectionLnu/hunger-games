/* eslint-disable react-hooks/rules-of-hooks */
import type { Unsubscribable } from "@trpc/server/observable";
import { describe, expect, it, vi } from "vitest";
import { lobbyHandler } from "~/server/api/logic/handler";

import type { BaseGamePlayerEvents } from "~/server/api/logic/core/base-game";
import type { TimerEvent } from "~/server/api/logic/core/timer";
import {
  cleanupLeftovers,
  expectEventEmitted,
  expectNotEvenEmitted,
  getLastEventOf,
  getManualTimer,
  getTestUserCallers,
  makePlayer,
  runAllMacroTasks,
  useAutomaticTimer,
  useManualTimer,
} from "./utils";

export const lobbyTests = () =>
  describe("Lobby", () => {
    makePlayer("test_user_1");
    makePlayer("test_user_2");

    describe("currentFight", () => {
      it("should not find a match for current user", async () => {
        const caller = await getTestUserCallers();

        const result = await caller.test_user_1.lobby.currentFight(undefined);

        expect(result).toEqual({ success: false });
      });

      it("should find a match for current user", () =>
        testFight(async ({ createGame, callers }) => {
          await createGame();

          const result =
            await callers.test_user_1.lobby.currentFight(undefined);
          expect(result).toHaveProperty("success", true);
        }));

      it("should not consider aborted matches");
    });

    describe("onFightUpdate", () => {
      it("should not emit when no fight is happening", () =>
        testFight(async ({ callers }) => {
          const listener = vi.fn();
          const un = (
            await callers.test_user_1.lobby.onFightUpdate({ id: "test_user_1" })
          ).subscribe({ next: listener });

          await runAllMacroTasks();

          expect(listener).not.toHaveBeenCalled();
          un.unsubscribe();
        }));

      it('should emit when a fight is happening and the "id" matches', () =>
        testFight(async ({ startGame, getLobby, callers }) => {
          const listener = vi.fn();
          const un = (
            await callers.test_user_1.lobby.onFightUpdate({ id: "test_user_1" })
          ).subscribe({ next: listener });

          await startGame();

          expect(listener).toHaveBeenCalledWith({
            type: "join",
            fightId: getLobby().fightId,
            game: "rock-paper-scissors",
          });
          un.unsubscribe();
        }));

      it("should emit when the game ended", () =>
        testFight(async ({ startGame, getLobby, callers }) => {
          const listener = vi.fn();
          const un = (
            await callers.test_user_1.lobby.onFightUpdate({ id: "test_user_1" })
          ).subscribe({ next: listener });

          await startGame();
          getLobby().endGame("test_user_1", "test_user_2");
          await new Promise((resolve) => getLobby().on("destroy", resolve));

          expect(listener).toHaveBeenCalledWith({
            type: "end",
            fightId: getLobby().fightId,
          });
          un.unsubscribe();
        }));
    });

    describe("BaseGame", () => {
      describe("Before game start", () => {
        it("should emit that a player joined", () =>
          testFight(async ({ createGame, connect, firstListener }) => {
            await createGame();

            await connect("test_user_1");
            await connect("test_user_2");

            const event = getLastEventOf(
              firstListener,
              "player-joined-readying",
            )!;
            expect(event.data.opponentStatus).toBe("joined");
          }));

        it("should emit that all players joined", () =>
          testFight(
            async ({ createGame, connect, firstListener, secondListener }) => {
              await createGame();

              await connect("test_user_1");
              await connect("test_user_2");

              expect(
                getLastEventOf(firstListener, "player-joined-readying")!.data
                  .opponentStatus,
              ).toBe("joined");
              expect(
                getLastEventOf(secondListener, "player-joined-readying")!.data
                  .opponentStatus,
              ).toBe("joined");
            },
          ));

        it("should emit that player is ready", () =>
          testFight(async ({ createGame, ready, connect, firstListener }) => {
            await createGame();

            await connect("test_user_1");
            await connect("test_user_2");
            await ready("test_user_2");

            const event = getLastEventOf(
              firstListener,
              "player-joined-readying",
            )!;
            expect(event.data.opponentStatus).toBe("ready");
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

          expect(lobbyHandler.getFight(fightId)).toBeUndefined();
        }));

      describe("Timeout", () => {
        it("should end the game when no player joins", () =>
          testFight(async ({ createGame, getLobby, timer }) => {
            await createGame();
            const lobby = getLobby();
            const listener = vi.fn();
            lobby.on("game-aborted", listener);

            timer.getFirstByName("force-game-end").emitTimeout();

            expect(listener).toHaveBeenCalledWith({
              data: undefined,
              fightId: lobby.fightId,
            });
            expect(lobby.isAborted).toBeTruthy();
          }));

        it("should mark the game as aborted if no player joins the game", () =>
          testFight(async ({ createGame, getLobby, timer }) => {
            await createGame();

            timer.getFirstByName("start-timer").emitTimeout();
            await runAllMacroTasks();

            expect(getLobby().isAborted).toBeTruthy();
          }));

        it("should mark the game as aborted if no player hits ready", () =>
          testFight(async ({ createGame, getLobby, timer, connect }) => {
            await createGame();

            await connect("test_user_1");
            await connect("test_user_2");
            timer.getFirstByName("start-timer").emitTimeout();
            await runAllMacroTasks();

            expect(getLobby().isAborted).toBeTruthy();
          }));

        it("if only one player marks ready, then he wins", () =>
          testFight(async ({ createGame, getLobby, ready, connect, timer }) => {
            await createGame();

            const lobby = getLobby();
            const listener = vi.fn();
            lobby.on("game-ended", listener);

            await connect("test_user_1");
            await ready("test_user_1");

            timer.getFirstByName("start-timer").emitTimeout();

            expect(listener).toHaveBeenCalledWith({
              data: {
                winnerId: "test_user_1",
                looserId: "test_user_2",
              },
              fightId: lobby.fightId,
            });
          }));

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

        it("should abort the game if all player are disconnected for to long", () =>
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
              const listener = vi.fn();
              lobby.on("game-aborted", listener);

              disconnect("test_user_2");
              disconnect("test_user_1");
              timer.getFirstByName("disconnect-timer").emitTimeout();

              expect(getLobby().isAborted).toBeTruthy();
              expectNotEvenEmitted(firstListener, "game-ended");
              expect(listener).toHaveBeenCalledWith({
                data: undefined,
                fightId: lobby.fightId,
              });
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
      args.getLobby().endGame("test_user_1", "test_user_2");
      await args.getFight().gameDone;
      await cleanupLeftovers({
        fightIds: [id],
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

  const firstListener = vi.fn<[BaseGamePlayerEvents], void>();
  const secondListener = vi.fn<[BaseGamePlayerEvents], void>();

  const state = {
    fightId: undefined as string | undefined,
    fight: undefined as ReturnType<(typeof lobbyHandler)["getFight"]>,
    test_user_1: undefined as Unsubscribable | undefined,
    test_user_2: undefined as Unsubscribable | undefined,
  };

  const createGame = async () => {
    lobbyHandler.defineNextGameType("rock-paper-scissors");

    const { id } = await callers.test_user_1.lobby.create({
      opponent: `test_user_2`,
    });
    state.fightId = id;
    state.fight = lobbyHandler.getFight(id)!;
  };

  const connect = async (userId: `test_user_${1 | 2}`) => {
    await callers[userId].lobby.join();
    const listener = userId === "test_user_1" ? firstListener : secondListener;
    const un = (
      await callers[userId].lobby.onGameAction({
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
    return callers[userId].lobby.ready();
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
