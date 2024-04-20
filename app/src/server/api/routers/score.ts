import { z } from "zod";
import { ScoreHandler } from "../logic/score";
import { createTRPCRouter, userProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { UserHandler } from "../logic/user";

export const scoreRouter = createTRPCRouter({
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

    return history.map(({ game, score, youWon, fightId, scoreChange }) => ({
      fightId,
      game,
      score,
      scoreChange,
      youWon,
    }));
  }),

  historyEntry: userProcedure
    .input(z.object({ fightId: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ScoreHandler.instance.getHistoryEntry(
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

      const userNames = await UserHandler.instance.getUserNames([
        winnerId,
        looserId,
      ]);
      if (userNames.errors.length > 0) {
        console.error(
          `[Score:HistoryEntry]: Error fetching opponent user name for the history of user '${ctx.user.clerkId}'`,
          userNames.errors,
        );
      }

      return {
        winnerName: userNames.map[winnerId]!,
        looserName: userNames.map[looserId]!,
        ...data,
      };
    }),
});
