import { z } from "zod";
import { createTRPCRouter, userProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { UserHandler } from "../logic/user";

export const userRouter = createTRPCRouter({
  getUserName: userProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      try {
        return UserHandler.instance.getUserName(input.id);
      } catch (error) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }
    }),
});
