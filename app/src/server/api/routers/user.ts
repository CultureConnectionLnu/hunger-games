import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { clerkHandler, userHandler } from "../logic/handler";
import {
  adminProcedure,
  createTRPCRouter,
  errorBoundary,
  moderatorProcedure,
  userProcedure,
} from "../trpc";

export const userRouter = createTRPCRouter({
  allUsers: adminProcedure.query(() =>
    errorBoundary(async () => getAllUserWithRoles()),
  ),

  allPlayer: moderatorProcedure.query(() =>
    errorBoundary(async () => {
      const allUsers = await getAllUserWithRoles();
      return allUsers.filter((x) => x.isPlayer);
    }),
  ),

  getYourRoles: userProcedure.query(({ ctx }) =>
    errorBoundary(async () => userHandler.getUserRoles(ctx.user.clerkId)),
  ),

  changeUserState: adminProcedure
    .input(
      z.object({
        id: z.string(),
        isPlayer: z.boolean().optional(),
        isMedic: z.boolean().optional(),
      }),
    )
    .mutation(({ input }) =>
      errorBoundary(async () => {
        const result = await userHandler.changeUserState(
          input.id,
          input.isPlayer,
          input.isMedic,
        );
        if (!result.success) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Failed to update player state",
          });
        }
        return { success: true } as const;
      }),
    ),
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
      isMedic: roles?.isMedic ?? false,
    };
  });
}
