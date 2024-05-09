import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { clerkHandler, scoreHandler } from "../logic/handler";
import { createTRPCRouter, playerProcedure, userProcedure } from "../trpc";

export const scoreRouter = createTRPCRouter({
  dashboard: userProcedure.query(async () => {
    const dashboardData = await scoreHandler.getDashboard();
    const userNames = await clerkHandler.getUserNames(
      dashboardData.map((x) => x.userId),
    );

    return dashboardData.map(({ rank, score, userId }) => ({
      rank,
      score,
      userId,
      userName: userNames[userId],
    }));
  }),

  history: playerProcedure.query(
    async ({ ctx }) => await scoreHandler.getHistory(ctx.user.clerkId),
  ),

  historyEntry: playerProcedure
    .input(z.object({ fightId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await scoreHandler.getHistoryEntry(
        ctx.user.clerkId,
        input.fightId,
      );

      if (!result.success) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Could not find a history entry for the current user with fightId: ${input.fightId}`,
        });
      }
      const { winnerId, looserId, ...data } = result.data;

      const userNames = await clerkHandler.getUserNames([winnerId, looserId]);

      return {
        winnerName: userNames[winnerId]!,
        looserName: userNames[looserId]!,
        ...data,
      };
    }),
});
