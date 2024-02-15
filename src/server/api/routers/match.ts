import { z } from "zod";
import { createTRPCRouter, userProcedure } from "~/server/api/trpc";
import { match } from "~/server/db/schema";
import { validate } from "uuid";

export const matchRouter = createTRPCRouter({
  create: userProcedure.mutation(async ({ ctx }) => {
    const value = await ctx.db
      .insert(match)
      .values({ type: "test" })
      .returning({ id: match.id });
    return value[0]!;
  }),
  exists: userProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!validate(input.id)) {
        return false;
      }
      const result = await ctx.db.query.match.findFirst({
        where: (matches, { eq }) => eq(matches.id, input.id),
      });
      return Boolean(result);
    }),
});
