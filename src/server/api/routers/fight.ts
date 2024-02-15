import { z } from "zod";
import { createTRPCRouter, userProcedure } from "~/server/api/trpc";
import { fight, usersToFight } from "~/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";

export const fightRouter = createTRPCRouter({
  create: userProcedure
    .input(
      z.object({
        opponent: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const opponent = await ctx.db.query.users.findFirst({
        where: (users, { eq }) => eq(users.clerkId, input.opponent),
      });

      if (!opponent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Opponent not found",
        });
      }

      const existingFight = await ctx.db
        .select()
        .from(fight)
        .leftJoin(usersToFight, eq(fight.id, usersToFight.fightId))
        .where(and(isNull(fight.winner), eq(usersToFight.userId, 1)))
        .limit(1)
        .execute();

      if(existingFight.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have an ongoing fight",
        });
      }

      return await ctx.db.transaction(async (tx) => {
        const newFights = await tx
          .insert(fight)
          // todo: implement games
          .values({ game: "test" })
          .returning({ id: fight.id });
        const newFight = newFights[0];

        if (!newFight) {
          tx.rollback();
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create fight",
          });
        }
        await tx.insert(usersToFight).values(
          [opponent, ctx.user].map((user) => ({
            fightId: newFight.id,
            userId: user.id,
          })),
        );

        return newFight;
      });
    }),
  canJoin: userProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.db.query.fight.findFirst({
        where: (matches, { and, eq, isNull }) =>
          and(isNull(matches.winner), eq(matches.id, input.id)),
        with: {
          participants: true,
        },
      });
      if (!result) {
        return false;
      }
      return result.participants.some(
        (participant) => participant.userId === ctx.user.id,
      );
    }),
});
