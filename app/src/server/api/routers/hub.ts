import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addHubSchema } from "~/lib/shared-schemas";
import { clerkHandler, hubHandler, userHandler } from "../logic/handler";
import { adminProcedure, createTRPCRouter } from "../trpc";

export const hubRouter = createTRPCRouter({
  allHubs: adminProcedure.query(async () => {
    const hubs = await hubHandler.getAllHubs();
    const userNames = await clerkHandler.getUserNames(
      hubs.map((x) => x.assignedModeratorId).filter(Boolean),
    );
    return hubs.map(({ name, assignedModeratorId, description, id }) => ({
      id,
      name,
      description: description ?? undefined,
      assignedModerator: assignedModeratorId
        ? {
            id: assignedModeratorId,
            name: userNames[assignedModeratorId]!,
          }
        : undefined,
    }));
  }),

  addHub: adminProcedure.input(addHubSchema).mutation(async ({ input }) => {
    try {
      if (
        input.assignedModeratorId &&
        (await userHandler.checkRole("moderator", input.assignedModeratorId))
      ) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "The person is already a moderator for another hub, so he can't be assigned to this hub.",
        });
      }

      await hubHandler.addHub(input);
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
        await hubHandler.removeHub(input.hubId);
        return { success: true } as const;
      } catch (err) {
        return { success: false, error: String(err) } as const;
      }
    }),

  updateHub: adminProcedure
    .input(addHubSchema.partial().and(z.object({ id: z.string() })))
    .mutation(async ({ input }) => {
      try {
        if (
          input.assignedModeratorId &&
          (await userHandler.checkRole("moderator", input.assignedModeratorId))
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "The person is already a moderator for another hub, so he can't be assigned to this hub.",
          });
        }
        const res = await hubHandler.updateHub(input);
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
