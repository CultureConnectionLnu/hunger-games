import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addHubSchema } from "~/lib/shared-schemas";
import { clerkHandler, hubHandler, userHandler } from "../logic/handler";
import { adminProcedure, createTRPCRouter, errorBoundary } from "../trpc";

export const hubRouter = createTRPCRouter({
  allHubs: adminProcedure.query(() =>
    errorBoundary(async () => {
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
  ),

  addHub: adminProcedure.input(addHubSchema).mutation(({ input }) =>
    errorBoundary(async () => {
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

      return await hubHandler.addHub(input);
    }),
  ),

  removeHub: adminProcedure
    .input(z.object({ hubId: z.string() }))
    .mutation(({ input }) =>
      errorBoundary(async () => hubHandler.removeHub(input.hubId)),
    ),

  updateHub: adminProcedure
    .input(addHubSchema.partial().and(z.object({ id: z.string() })))
    .mutation(({ input }) =>
      errorBoundary(async () => {
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
        return true;
      }),
    ),
});
