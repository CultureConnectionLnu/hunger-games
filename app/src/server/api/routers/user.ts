import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { clerkHandler, userHandler } from "../logic/handler";
import {
  adminProcedure,
  createTRPCRouter,
  moderatorProcedure,
  userProcedure,
} from "../trpc";

export const userRouter = createTRPCRouter({
  allUsers: adminProcedure.query(async () => getAllUserWithRoles()),

  allPlayer: moderatorProcedure.query(async () => {
    const allUsers = await getAllUserWithRoles();
    return allUsers.filter((x) => x.isPlayer);
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

async function getAllUserWithRoles() {
  const result = await clerkHandler.getAllUsers();
  if (!result.success) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Failed to get all users",
    });
  }

  const allRoles = (
    await Promise.all(
      result.users.map((x) => userHandler.getUserRoles(x.userId)),
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
}
