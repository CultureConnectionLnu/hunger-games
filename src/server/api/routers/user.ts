import { z } from "zod";
import { createTRPCRouter, userProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
// import { clerkClient } from "@clerk/nextjs";
/**
 * Hack to get rid of:
 * import { clerkClient } from "@clerk/nextjs";
 *          ^
 * SyntaxError: The requested module '@clerk/nextjs' does not provide an export named 'auth'
 */
const clerkModule = import("@clerk/nextjs");

export const userRouter = createTRPCRouter({
  getUserName: userProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      /**
       * INFO: this is bad practice.
       * This makes it easy to query user names by random chance.
       *
       * But it is needed in this case, as the web socket connection is not secure and
       * can therefore not access the clerk session.
       */
      // HACK to get clerk working with web socket
      const { clerkClient } = await clerkModule;
      try {
        const user = await clerkClient.users.getUser(input.id);
        if(user.firstName && user.lastName){
            return `${user.firstName} ${user.lastName}`;
        }
        if(user.firstName){
            return user.firstName;
        }
        if(user.username){
            return user.username;
        }

        return "Anonymous User";
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
    }),
});
