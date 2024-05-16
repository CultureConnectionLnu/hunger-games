import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { clerkHandler, scoreHandler } from "../logic/handler";
import {
  createTRPCRouter,
  errorBoundary,
  playerProcedure,
  userProcedure,
} from "../trpc";

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

  getHistory: playerProcedure.query(({ ctx }) =>
    errorBoundary(async () => scoreHandler.getHistory(ctx.user.clerkId)),
  ),

  getCurrentScore: playerProcedure.query(({ ctx }) =>
    errorBoundary(async () => scoreHandler.currentScore(ctx.user.clerkId)),
  ),

  getFightDetails: playerProcedure
    .input(z.object({ fightId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await scoreHandler.getFightDetails(
        ctx.user.clerkId,
        input.fightId,
      );

      if (!result.success) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Could not find a history entry for the current user with fightId: ${input.fightId}`,
        });
      }
      const { opponentId, ...data } = result.data;

      const userNames = await clerkHandler.getUserName(opponentId);

      return {
        opponentName: userNames,
        ...data,
      };
    }),
});
