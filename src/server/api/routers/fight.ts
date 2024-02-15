import { z } from "zod";
import { createTRPCRouter, userProcedure } from "~/server/api/trpc";
import { fight } from "~/server/db/schema";
import { validate } from "uuid";

export const fightRouter = createTRPCRouter({
  create: userProcedure.mutation(async ({ ctx }) => {
    const value = await ctx.db
      .insert(fight)
      .values({ game: "test" })
      .returning({ id: fight.id });
    return value[0]!;
  }),
  exists: userProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!validate(input.id)) {
        return false;
      }
      const result = await ctx.db.query.fight.findFirst({
        where: (matches, { eq }) => eq(matches.id, input.id),
      });
      return Boolean(result);
    }),
});
