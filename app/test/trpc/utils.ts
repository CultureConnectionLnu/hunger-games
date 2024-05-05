import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, type Mock } from "vitest";
import { TimerFactory } from "~/server/api/logic/core/timer";
import { UserHandler } from "~/server/api/logic/user";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

export function provideTestUsers() {
  beforeAll(async () => {
    await UserHandler.instance.createUser("test_user_1");
    await UserHandler.instance.createUser("test_user_2");
  });

  afterAll(async () => {
    await db
      .delete(users)
      .where(inArray(users.clerkId, ["test_user_1", "test_user_2"]));
  });
}

export function makePlayer(user: `test_user_1` | `test_user_2`) {
  beforeAll(async () => {
    await UserHandler.instance.changePlayerState(user, true);
  });

  afterAll(async () => {
    await UserHandler.instance.changePlayerState(user, false);
  });
}

export function useManualTimer() {
  TimerFactory.instance.useManual();
}

export function useAutomaticTimer() {
  TimerFactory.instance.useAutomatic();
}

export function useMockUserNames() {
  UserHandler.instance.useMockUserNames({
    test_user_1: "Test User 1",
    test_user_2: "Test User 2",
  });
}
export function useRealUserNames() {
  UserHandler.instance.useRealUserNames();
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
