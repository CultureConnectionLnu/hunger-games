import { ScoreHandler } from "../logic/score";
import { createTRPCRouter, userProcedure } from "../trpc";

export const scoreRouter = createTRPCRouter({
  currentScore: userProcedure.query(async ({ ctx }) =>
    ScoreHandler.instance.currentScore(ctx.user.clerkId),
  ),
  scoreBoard: userProcedure.query(
    async () => await ScoreHandler.instance.getScoreBoard(),
  ),
});
