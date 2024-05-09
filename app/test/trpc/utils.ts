import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, type Mock } from "vitest";
import { TimerFactory } from "~/server/api/logic/core/timer";
import { clerkHandler, userHandler } from "~/server/api/logic/handler";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

type MockUsers = Parameters<(typeof clerkHandler)["useMockImplementation"]>[0];
export type MockUserIds = (typeof mockUsers)[number]["userId"];
export const mockUsers = [
  {
    name: "Test User 1",
    userId: "test_user_1",
    isAdmin: false,
  } as const,
  {
    name: "Test User 2",
    userId: "test_user_2",
    isAdmin: false,
  } as const,
] satisfies MockUsers;

export function provideTestUsers() {
  beforeAll(async () => {
    for (const mockUser of mockUsers) {
      await userHandler.createUser(mockUser.userId);
    }
    clerkHandler.useMockImplementation(mockUsers);
  });

  afterAll(async () => {
    await db.delete(users).where(
      inArray(
        users.clerkId,
        mockUsers.map((x) => x.userId),
      ),
    );
    clerkHandler.useActualImplementation();
  });
}

export function makePlayer(user: MockUserIds) {
  beforeAll(async () => {
    await userHandler.changePlayerState(user, true);
  });

  afterAll(async () => {
    await userHandler.changePlayerState(user, false);
  });
}

export function useManualTimer() {
  TimerFactory.instance.useManual();
}

export function useAutomaticTimer() {
  TimerFactory.instance.useAutomatic();
}

export function getManualTimer() {
  const getByName = (name: string) => {
    return TimerFactory.instance.manualLookup.filter(
      (timer) => timer.name === name,
    );
  };
  const getFirstByName = (name: string) => {
    const timer = getByName(name)[0];
    if (!timer) throw new Error("No timers created");
    return timer;
  };
  const getLastByName = (name: string) => {
    const all = getByName(name);
    const lastTimer = all[all.length - 1];
    if (!lastTimer) throw new Error("No timer created");
    return lastTimer;
  };
  const getAll = () => TimerFactory.instance.manualLookup;

  const simulateNormalTimeout = async (
    timer: ReturnType<typeof getFirstByName>,
  ) => {
    for (let i = 0; i < timer.timeoutAfterSeconds; i++) {
      timer.emitNextSecond();
      await runAllMacroTasks();
    }
    timer.emitTimeout();
    await runAllMacroTasks();
  };

  return {
    getAll,
    getByName,
    getFirstByName,
    getLastByName,
    simulateNormalTimeout,
  };
}

type FilterByEvent<T, Key> = T extends { event: Key } ? T : never;

export function getEventsOf<
  T extends { event: string },
  Key extends T["event"],
>(listener: Mock<[T], void>, event: Key) {
  return listener.mock.calls
    .map(([args]) => args)
    .filter((args) => args.event === event) as FilterByEvent<T, Key>[];
}

export function getLastEventOf<
  T extends { event: string },
  Key extends T["event"],
>(listener: Mock<[T], void>, event: Key) {
  const events = getEventsOf(listener, event);
  return events[events.length - 1];
}

export function expectEventEmitted<
  T extends { event: string },
  Key extends T["event"],
>(listener: Mock<[T], void>, event: Key) {
  const events = getEventsOf(listener, event);
  if (events.length === 0) {
    throw new Error(`Expected event ${event} to be emitted but it was not`);
  }
}

export function expectNotEvenEmitted<
  T extends { event: string },
  Key extends T["event"],
>(listener: Mock<[T], void>, event: Key) {
  const events = getEventsOf(listener, event);
  if (events.length !== 0) {
    throw new Error(
      `Expected event ${event} not to be emitted but it was: ${events.length}`,
    );
  }
}

export async function runAllMacroTasks() {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
