import type { Unsubscribable } from "@trpc/server/observable";
import { desc, eq, inArray } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";
import { TypedEventEmitter } from "~/lib/event-emitter";
import type { BaseGamePlayerEvents } from "~/server/api/logic/core/base-game-state";
import { TimeFunctions } from "~/server/api/logic/core/timeout-counter";
import { FightHandler } from "~/server/api/logic/fight";

import { appRouter } from "~/server/api/root";
import { createCommonContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { fight, users } from "~/server/db/schema";

describe("Fight", () => {
  beforeAll(async () => {
    await db.insert(users).values([
      {
        clerkId: "test_user_1",
        role: "user",
      },
      {
        clerkId: "test_user_2",
        role: "user",
      },
    ]);
  });

  afterAll(async () => {
    await db
      .delete(users)
      .where(inArray(users.clerkId, ["test_user_1", "test_user_2"]));
  });

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

        const result = await callers.test_user_1.fight.currentFight(undefined);
        expect(result).toHaveProperty("success", true);
      }));
  });

  describe("BaseGame", () => {
    describe("Before game start", () => {
      it("should emit that a player joined", () =>
        testFight(
          async ({
            createGame,
            join,
            connect,
            firstListener,
            getLastEventOf,
          }) => {
            await createGame();

            await join("test_user_1");
            await connect("test_user_1");

            const event = getLastEventOf(
              firstListener,
              "player-joined-readying",
            )!;
            expect(event.data.joined).toContain("test_user_1");
          },
        ));

      it("should emit that all players joined", () =>
        testFight(
          async ({
            createGame,
            join,
            connect,
            firstListener,
            secondListener,
            getLastEventOf,
          }) => {
            await createGame();

            await join("test_user_1");
            await join("test_user_2");
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
        testFight(
          async ({
            createGame,
            join,
            ready,
            connect,
            firstListener,
            getLastEventOf,
          }) => {
            await createGame();

            await join("test_user_1");
            await connect("test_user_1");
            await ready("test_user_1");

            const event = getLastEventOf(
              firstListener,
              "player-joined-readying",
            )!;
            expect(event.data.ready).toEqual(["test_user_1"]);
            expect(event.data.joined).toEqual([]);
          },
        ));

      it("should emit that all players are ready", () =>
        testFight(
          async ({
            createGame,
            join,
            ready,
            connect,
            firstListener,
            getLastEventOf,
            expectEventEmitted,
          }) => {
            await createGame();

            await join("test_user_1");
            await join("test_user_2");
            await connect("test_user_1");
            await connect("test_user_2");
            await ready("test_user_1");
            await ready("test_user_2");

            const event = getLastEventOf(
              firstListener,
              "player-joined-readying",
            )!;
            expect(event.data.ready).toEqual(["test_user_1", "test_user_2"]);
            expect(event.data.joined).toEqual([]);

            expectEventEmitted(firstListener, "all-player-ready");
          },
        ));
    });

    it("should start the game", () =>
      testFight(
        async ({
          startGame,
          runAllMacroTasks,
          firstListener,
          expectEventEmitted,
        }) => {
          await startGame();

          await runAllMacroTasks();

          expectEventEmitted(firstListener, "game-in-progress");
        },
      ));

    it("should pause the game when a player disconnects", () =>
      testFight(
        async ({
          startGame,
          disconnect,
          firstListener,
          secondListener,
          getLastEventOf,
          expectEventEmitted,
        }) => {
          await startGame();
          disconnect("test_user_1");

          expectEventEmitted(secondListener, "game-halted");
          expect(getLastEventOf(firstListener, "game-halted")).toBeUndefined();
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
          expectEventEmitted,
        }) => {
          await startGame();
          disconnect("test_user_1");
          await connect("test_user_1");

          expectEventEmitted(secondListener, "game-resume");
          expectEventEmitted(firstListener, "game-resume");
        },
      ));

    describe("Timeout", () => {
      it("should end the game when no player joins", () =>
        testFight(async ({ createGame, getGame }) => {
          const timeoutMock = await mockSetTimeout(() => createGame());
          const forceEndTimeout = timeoutMock.getFirst();
          const game = getGame();
          const listener = vi.fn();
          game.on("canceled", listener);

          forceEndTimeout();

          expect(listener).toHaveBeenCalledWith({
            data: {
              reason: "force-stop",
            },
            fightId: game.fightId,
          });
        }));

      it("should cancel the game if only one player joins", () =>
        testFight(async ({ createGame, getGame, join, connect }) => {
          const timeoutMock = await mockSetTimeout(() => createGame());
          const startTimeout = timeoutMock.getLast();
          const game = getGame();
          const listener = vi.fn();
          game.on("canceled", listener);

          await join("test_user_1");
          await connect("test_user_1");

          startTimeout();

          expect(listener).toHaveBeenCalledWith({
            data: {
              reason: "start-timeout",
            },
            fightId: game.fightId,
          });
        }));

      it("should cancel the game if only one player is ready", () =>
        testFight(async ({ createGame, getGame, join, ready, connect }) => {
          const timeoutMock = await mockSetTimeout(() => createGame());
          const startTimeout = timeoutMock.getLast();

          const game = getGame();
          const listener = vi.fn();
          game.on("canceled", listener);

          await join("test_user_1");
          await connect("test_user_1");
          await ready("test_user_1");

          startTimeout();

          expect(listener).toHaveBeenCalledWith({
            data: {
              reason: "start-timeout",
            },
            fightId: game.fightId,
          });
        }));

      it("should cancel the game if someone disconnected before the game started", () =>
        testFight(
          async ({ createGame, getGame, join, connect, disconnect }) => {
            const timeoutMock = await mockSetTimeout(() => createGame());
            const startTimeout = timeoutMock.getLast();

            const game = getGame();
            const listener = vi.fn();
            game.on("canceled", listener);

            await join("test_user_1");
            await connect("test_user_1");
            await join("test_user_2");
            await connect("test_user_2");
            disconnect("test_user_1");

            startTimeout();

            expect(listener).toHaveBeenCalledWith({
              data: {
                reason: "start-timeout",
              },
              fightId: game.fightId,
            });
          },
        ));

      it("should end the game if a player is disconnected for to long", () =>
        testFight(
          async ({
            startGame,
            getGame,
            disconnect,
            getLastEventOf,
            firstListener,
          }) => {
            await startGame();
            const game = getGame();
            const cancelListener = vi.fn();
            game.on("canceled", cancelListener);

            const timeoutMock = await mockSetTimeout(() =>
              disconnect("test_user_2"),
            );
            const disconnectTimerEnd = timeoutMock.getFirst();

            disconnectTimerEnd();

            expect(cancelListener).toHaveBeenCalledWith({
              data: {
                reason: "disconnect-timeout",
              },
              fightId: game.fightId,
            });
            const winEvent = getLastEventOf(firstListener, "game-ended")!;
            expect(winEvent.data).toEqual({
              winnerId: "test_user_1",
              looserId: "test_user_2",
            });
          },
        ));

      it("should end the game if a player is disconnected for to long", () =>
        testFight(
          async ({
            startGame,
            getGame,
            disconnect,
            getLastEventOf,
            firstListener,
          }) => {
            await startGame();
            const game = getGame();
            const cancelListener = vi.fn();
            game.on("canceled", cancelListener);

            const timeoutMock = await mockSetTimeout(() =>
              disconnect("test_user_2"),
            );
            const disconnectTimerEnd = timeoutMock.getFirst();

            disconnectTimerEnd();

            expect(cancelListener).toHaveBeenCalledWith({
              data: {
                reason: "disconnect-timeout",
              },
              fightId: game.fightId,
            });
            const winEvent = getLastEventOf(firstListener, "game-ended")!;
            expect(winEvent.data).toEqual({
              winnerId: "test_user_1",
              looserId: "test_user_2",
            });
          },
        ));

      it("should end the game if all player are disconnected for to long", () =>
        testFight(
          async ({
            startGame,
            getGame,
            disconnect,
            expectNotEvenEmitted,
            firstListener,
          }) => {
            await startGame();
            const game = getGame();
            const cancelListener = vi.fn();
            game.on("canceled", cancelListener);

            const timeoutMock = await mockSetTimeout(() => {
              disconnect("test_user_2");
              disconnect("test_user_1");
            });
            const disconnectTimerEnd = timeoutMock.getFirst();

            disconnectTimerEnd();

            expect(cancelListener).toHaveBeenLastCalledWith({
              data: {
                reason: "force-stop",
              },
              fightId: game.fightId,
            });
            expectNotEvenEmitted(firstListener, "game-ended");
          },
        ));
    });
  });
});

function mockSetTimeout(fn: () => void | Promise<void>) {
  const timeOut = vi.fn<[() => void, number], void>();
  TimeFunctions.instance.mock({
    // @ts-expect-error it is a mock, so it is fine
    setTimeout: timeOut,
  });
  const result = fn();

  const getFirst = () => timeOut.mock.calls[0]![0];
  const getLast = () => timeOut.mock.calls[timeOut.mock.calls.length - 1]![0];
  const getAll = () => timeOut.mock.calls.map(([fn]) => fn);

  const mock = {
    getFirst,
    getLast,
    getAll,
  };

  if (result instanceof Promise) {
    return result.then(() => {
      TimeFunctions.instance.useReal();
      return mock;
    });
  }
  TimeFunctions.instance.useReal();
  return Promise.resolve().then(() => mock);
}

async function testFight(
  test: (args: Awaited<ReturnType<typeof setupTest>>) => Promise<void>,
) {
  const args = await setupTest();

  return await test(args)
    .then(() => ({ pass: true, error: undefined }) as const)
    .catch((error: Error) => ({ pass: false, error }) as const)
    .then(async (x) => {
      const id = args.getFightId();
      if (id === undefined) return x;

      // finish the game properly before deleting
      args.getGame().endGame("test_user_1");
      args.getGame().destroy();
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
    game: undefined as ReturnType<FightHandler["getGame"]>,
    test_user_1: undefined as Unsubscribable | undefined,
    test_user_2: undefined as Unsubscribable | undefined,
  };

  const createGame = async () => {
    FightHandler.instance.defineNextGameType("rock-paper-scissors");

    const { id } = await callers.test_user_1.fight.create({
      opponent: `test_user_2`,
    });
    state.fightId = id;
    state.game = FightHandler.instance.getGame(id)!;
  };

  const connect = async (userId: `test_user_${1 | 2}`) => {
    const listener = userId === "test_user_1" ? firstListener : secondListener;
    const un = (
      await callers[userId].fight.onAction({ userId, fightId: state.fightId! })
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

  const join = async (userId: `test_user_${1 | 2}`) => {
    return callers[userId].fight.join();
  };

  const ready = async (userId: `test_user_${1 | 2}`) => {
    return callers[userId].fight.ready();
  };

  const startGame = async () => {
    await createGame();

    await join("test_user_1");
    await join("test_user_2");
    await connect("test_user_1");
    await connect("test_user_2");
    await ready("test_user_1");
    await ready("test_user_2");
  };

  type FilterByEvent<T, Key> = T extends { event: Key } ? T : never;

  const getEventsOf = <Key extends BaseGamePlayerEvents["event"]>(
    listener: Mock<[BaseGamePlayerEvents], void>,
    event: Key,
  ) => {
    return listener.mock.calls
      .map(([args]) => args)
      .filter((args) => args.event === event) as FilterByEvent<
      BaseGamePlayerEvents,
      Key
    >[];
  };

  const getLastEventOf = <Key extends BaseGamePlayerEvents["event"]>(
    listener: Mock<[BaseGamePlayerEvents], void>,
    event: Key,
  ) => {
    const events = getEventsOf(listener, event);
    return events[events.length - 1];
  };

  const expectEventEmitted = <Key extends BaseGamePlayerEvents["event"]>(
    listener: Mock<[BaseGamePlayerEvents], void>,
    event: Key,
  ) => {
    const events = getEventsOf(listener, event);
    if (events.length === 0) {
      throw new Error(`Expected event ${event} to be emitted but it was not`);
    }
  };

  const expectNotEvenEmitted = <Key extends BaseGamePlayerEvents["event"]>(
    listener: Mock<[BaseGamePlayerEvents], void>,
    event: Key,
  ) => {
    const events = getEventsOf(listener, event);
    if (events.length !== 0) {
      throw new Error(
        `Expected event ${event} not to be emitted but it was: ${events.length}`,
      );
    }
  };

  const runAllMacroTasks = async () => {
    return new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  };

  return {
    callers,
    getFightId: () => state.fightId,
    getGame: () => state.game!.instance,
    createGame,
    connect,
    disconnect,
    join,
    ready,
    startGame,
    runAllMacroTasks,
    firstListener,
    secondListener,
    getEventsOf,
    getLastEventOf,
    expectNotEvenEmitted,
    expectEventEmitted,
  };
}
