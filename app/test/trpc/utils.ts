import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, type Mock } from "vitest";
import { TypedEventEmitter } from "~/lib/event-emitter";
import { TimerFactory } from "~/server/api/logic/core/timer";
import { clerkHandler, userHandler } from "~/server/api/logic/handler";
import { appRouter } from "~/server/api/root";
import { createCommonContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { fight, gamePlayerState, quest, users } from "~/server/db/schema";
import { type RouterInputs } from "~/trpc/shared";

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
  {
    name: "Test Medic",
    userId: "test_medic",
    isAdmin: false,
  } as const,
  {
    name: "Test Admin",
    userId: "test_admin",
    isAdmin: true,
  } as const,
  {
    name: "Test Moderator 1",
    userId: "test_moderator_1",
    isAdmin: false,
  } as const,
  {
    name: "Test Moderator 2",
    userId: "test_moderator_2",
    isAdmin: false,
  } as const,
  {
    name: "Test Moderator 3",
    userId: "test_moderator_3",
    isAdmin: false,
  } as const,
  {
    name: "Test Moderator 4",
    userId: "test_moderator_4",
    isAdmin: false,
  } as const,
] satisfies MockUsers;

const mockClerkFunctions: Partial<
  ReturnType<(typeof clerkHandler)["useMockImplementation"]>
> = {};

export function provideTestUsers() {
  beforeAll(async () => {
    for (const mockUser of mockUsers) {
      await userHandler.createUser(mockUser.userId);
    }
    const { setCurrentUserId } = clerkHandler.useMockImplementation(mockUsers);
    mockClerkFunctions.setCurrentUserId = setCurrentUserId;
  });

  afterAll(async () => {
    await db.delete(users).where(
      inArray(
        users.clerkId,
        mockUsers.map((x) => x.userId),
      ),
    );
    clerkHandler.useActualImplementation();
    mockClerkFunctions.setCurrentUserId = undefined;
  });
}

export function makePlayer(user: MockUserIds) {
  beforeAll(async () => {
    await userHandler.changeUserState(user, true);
  });

  afterAll(async () => {
    await userHandler.changeUserState(user, false);
  });
}

export function makeMedic(user: MockUserIds) {
  beforeAll(async () => {
    await userHandler.changeUserState(user, undefined, true);
  });

  afterAll(async () => {
    await userHandler.changeUserState(user, undefined, false);
  });
}

type TestHubs = Omit<RouterInputs["hub"]["addHub"], "assignedModeratorId"> & {
  assignedModeratorId: MockUserIds;
  id?: string;
};
export type ModeratorIds = (typeof testHubs)[number]["assignedModeratorId"];
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

export function makeHubs() {
  const data = [] as TestHubs[];
  const registerHubHooks = () => {
    beforeAll(async () => {
      const callers = await getTestUserCallers();
      for (const hub of testHubs) {
        const newHubId = await callers.test_admin.hub.addHub(hub);
        data.push({ ...hub, id: newHubId });
      }
    });

    afterAll(async () => {
      const callers = await getTestUserCallers();
      for (const hub of data) {
        if (!hub.id) continue;
        await callers.test_admin.hub.removeHub({ hubId: hub.id });
      }
    });
  };

  return {
    registerHubHooks,
    getHubData: () => data,
  };
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
  const getLastRunningByName = (name: string) => {
    const all = getByName(name).filter((x) => x.isRunning);
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
    getLastRunningByName,
    simulateNormalTimeout,
  };
}

export async function resetWoundedPlayers() {
  await db
    .update(gamePlayerState)
    .set({ isWounded: false, reviveCoolDownEnd: null })
    .where(inArray(gamePlayerState.userId, ["test_user_1", "test_user_2"]));
}

export async function cleanupLeftovers({
  fightIds,
  questIds,
}: {
  fightIds?: string[];
  questIds?: string[];
}) {
  if (fightIds && fightIds.length > 0) {
    await db.delete(fight).where(inArray(fight.id, fightIds));
  }
  if (questIds && questIds.length > 0) {
    await db.delete(quest).where(inArray(quest.id, questIds));
  }
  await resetWoundedPlayers();
}

export async function getTestUserCallers() {
  const callers = {} as Record<
    MockUserIds,
    ReturnType<typeof appRouter.createCaller>
  >;
  for (const mockUser of mockUsers) {
    const caller = appRouter.createCaller(
      await createCommonContext({
        userId: mockUser.userId,
      }),
    );
    Object.defineProperty(callers, mockUser.userId, {
      get() {
        mockClerkFunctions.setCurrentUserId?.(mockUser.userId);
        return caller;
      },
      configurable: false,
      enumerable: true,
    });
  }
  return callers;
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
