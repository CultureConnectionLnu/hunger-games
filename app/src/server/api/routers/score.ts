import { z } from "zod";
import { ScoreHandler } from "../logic/score";
import { createTRPCRouter, userProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { UserHandler } from "../logic/user";

export const scoreRouter = createTRPCRouter({
  currentScore: userProcedure.query(({ ctx }) =>
    ScoreHandler.instance.currentScore(ctx.user.clerkId),
  ),

  dashboard: userProcedure.query(async () => {
    const dashboardData = await ScoreHandler.instance.getDashboard();
    const allIds = new Set(dashboardData.map((x) => x.userId));
    const userNames = await UserHandler.instance.getUserNames([...allIds]);
    if (userNames.errors.length > 0) {
      console.error("Error fetching user names:", userNames.errors);
    }

    return dashboardData.map(({ rank, score, userId }) => ({
      rank,
      score,
      userId,
      userName: userNames.map[userId],
    }));
  }),

  scoreFromGame: userProcedure
    .input(
      z.object({
        fightId: z.string(),
        userId: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const result = await ScoreHandler.instance.getScoreFromGame(
        input.fightId,
        input.userId,
      );
      if (result.success === false) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No score available for the game: ${input.fightId}`,
        });
      }
      return result.score;
    }),
});
