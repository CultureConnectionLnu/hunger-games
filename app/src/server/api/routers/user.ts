import { TRPCError } from "@trpc/server";
import { UserHandler } from "../logic/user";
import { adminProcedure, createTRPCRouter } from "../trpc";

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
    return result.users;
  }),
});
