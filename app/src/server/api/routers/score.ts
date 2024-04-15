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
    const userNames = await UserHandler.instance.getUserNames(
      dashboardData.map((x) => x.userId),
    );
    if (userNames.errors.length > 0) {
      console.error(
        "[Score:Dashboard] Error fetching user names:",
        userNames.errors,
      );
    }

    return dashboardData.map(({ rank, score, userId }) => ({
      rank,
      score,
      userId,
      userName: userNames.map[userId],
    }));
  }),

  history: userProcedure.query(async ({ ctx }) => {
    const { history, failedFightIds } = await ScoreHandler.instance.getHistory(
      ctx.user.clerkId,
    );
    if (failedFightIds.length > 0) {
      console.error(
        `[Score:History]: Unable to fetch following fight ids for the history of user '${ctx.user.clerkId}'`,
        failedFightIds,
      );
    }

    const fightsMissingOpponent = history.filter(
      (x) => x.opponentId === undefined,
    );
    if (fightsMissingOpponent.length > 0) {
      console.error(
        `[Score:History]: Could not find opponent of the following fights for the history of user '${ctx.user.clerkId}'`,
        fightsMissingOpponent.map((x) => x.fightId),
      );
    }

    const userNames = await UserHandler.instance.getUserNames(
      history.map((x) => x.opponentId).filter(Boolean),
    );
    if (userNames.errors.length > 0) {
      console.error(
        `[Score:History]: Error fetching opponent user names for the history of user '${ctx.user.clerkId}'`,
        userNames.errors,
      );
    }

    return history.map(({ game, opponentId, score, youWon, fightId }) => ({
      fightId,
      game,
      score,
      youWon,
      opponent:
        opponentId === undefined
          ? UserHandler.backupUserName
          : userNames.map[opponentId],
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
