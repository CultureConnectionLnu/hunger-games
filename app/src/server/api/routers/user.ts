import { TRPCError } from "@trpc/server";
import { UserHandler } from "../logic/user";
import { adminProcedure, createTRPCRouter, userProcedure } from "../trpc";
import { z } from "zod";

export const userRouter = createTRPCRouter({
  allUsers: adminProcedure.query(async () => {
    const result = await UserHandler.instance.getAllClerkUsers();
    if (!result.success) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch users",
        cause: result.error,
      });
    }
    const allRoles = (
      await Promise.all(
        result.users.map((x) => UserHandler.instance.getUserRoles(x.userId)),
      )
    ).filter(Boolean);
    return result.users.map((user) => {
      const roles = allRoles.find((y) => y.id === user.userId);
      return {
        ...user,
        isModerator: roles?.isModerator ?? false,
        isPlayer: roles?.isPlayer ?? false,
      };
    });
  }),

  getYourRoles: userProcedure.query(({ ctx }) => {
    return UserHandler.instance.getUserRoles(ctx.user.clerkId);
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
        const result = await UserHandler.instance.changePlayerState(
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
        console.error('failed to update player state because: ', error)
        return { success: false, error: String(error) } as const;
      }
    }),
});
