import { z } from "zod";
import { ScoreHandler } from "../logic/score";
import { createTRPCRouter, userProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const scoreRouter = createTRPCRouter({
  currentScore: userProcedure.query(({ ctx }) =>
    ScoreHandler.instance.currentScore(ctx.user.clerkId),
  ),
  dashboard: userProcedure.query(() => ScoreHandler.instance.getDashboard()),
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
