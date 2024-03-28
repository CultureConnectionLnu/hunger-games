import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TypedEventEmitter } from "~/lib/event-emitter";

import { appRouter } from "~/server/api/root";
import { createCommonContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";

describe("fight", () => {
  beforeAll(async () => {
    await db.insert(users).values({
      clerkId: "test_user_1",
      role: "user",
    });
    await db.insert(users).values({
      clerkId: "test_user_2",
      role: "user",
    });
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

    it("should find a match for current user", async () => {
      const ctx = await createCommonContext({
        ee: new TypedEventEmitter(),
        userId: "test_user_1",
      });
      const caller = appRouter.createCaller(ctx);
      await caller.fight.create({ opponent: "test_user_2" });
      const result = await caller.fight.currentFight(undefined);

      expect(result).toHaveProperty('success', true);
    });
  });
});
