import { TRPCError } from "@trpc/server";
import { UserHandler } from "../logic/user";
import { adminProcedure, createTRPCRouter, userProcedure } from "../trpc";

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
});
