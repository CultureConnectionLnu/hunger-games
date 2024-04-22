import { addHubSchema } from "~/lib/shared-schemas";
import { QuestHandler } from "../logic/quest";
import { UserHandler } from "../logic/user";
import { adminProcedure, createTRPCRouter } from "../trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";

export const questRouter = createTRPCRouter({
  allHubs: adminProcedure.query(async () => {
    const hubs = await QuestHandler.instance.getAllHubs();
    const userNames = await UserHandler.instance.getUserNames(
      hubs.map((x) => x.assignedModeratorId).filter(Boolean),
    );
    if (userNames.errors.length > 0) {
      console.error(
        `[Quest:addHubs] could not get usernames all users`,
        userNames.errors,
      );
    }
    return hubs.map(({ name, assignedModeratorId, description, id }) => ({
      id,
      name,
      description: description ?? undefined,
      assignedModerator: assignedModeratorId
        ? {
            id: assignedModeratorId,
            name: userNames.map[assignedModeratorId]!,
          }
        : undefined,
    }));
  }),

  addHub: adminProcedure.input(addHubSchema).mutation(async ({ input }) => {
    try {
      await QuestHandler.instance.addHub(input);
      return {
        success: true,
      } as const;
    } catch (err) {
      return {
        success: false,
        error: String(err),
      } as const;
    }
  }),

  removeHub: adminProcedure
    .input(z.object({ hubId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await QuestHandler.instance.removeHub(input.hubId);
        return { success: true } as const;
      } catch (err) {
        return { success: false, error: String(err) } as const;
      }
    }),

  updateHub: adminProcedure
    .input(addHubSchema.partial().and(z.object({ id: z.string() })))
    .mutation(async ({ input }) => {
      try {
        const res = await QuestHandler.instance.updateHub(input);
        if (res.length === 0) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No Hub with that ID found",
          });
        }
        return { success: true } as const;
      } catch (err) {
        return { success: false, error: String(err) } as const;
      }
    }),
});
