import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { userHandler } from "../logic/handler";
import {
  adminProcedure,
  createTRPCRouter,
  ifAnyRoleProcedure,
  userProcedure,
} from "../trpc";

export const userRouter = createTRPCRouter({
  allUsers: ifAnyRoleProcedure("moderator", "admin").query(async () => {
    const result = await userHandler.getAllUsers();

    const allRoles = (
      await Promise.all(result.map((x) => userHandler.getUserRoles(x.clerkId)))
    ).filter(Boolean);

    return result.map((user) => {
      const roles = allRoles.find((y) => y.id === user.clerkId);
      return {
        ...user,
        isModerator: roles?.isModerator ?? false,
        isPlayer: roles?.isPlayer ?? false,
      };
    });
  }),

  getYourRoles: userProcedure.query(({ ctx }) => {
    return userHandler.getUserRoles(ctx.user.clerkId);
  }),

  changePlayerState: adminProcedure
    .input(
      z.object({
        id: z.string(),
        isPlayer: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      try {
        const result = await userHandler.changePlayerState(
          input.id,
          input.isPlayer,
        );
        if (!result.success) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Failed to update player state",
          });
        }
        return { success: true } as const;
      } catch (error) {
        console.error("failed to update player state because: ", error);
        return { success: false, error: String(error) } as const;
      }
    }),
});
