import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  userProcedure,
} from "~/server/api/trpc";
import { fight, usersToFight } from "~/server/db/schema";

const messageSchema = z.object({
  fightId: z.string().uuid(),
  game: z.string(),
  players: z.array(z.string()).min(2).max(2),
});
type Message = Pick<z.TypeOf<typeof messageSchema>, "fightId" | "game">;

declare module "~/lib/event-emitter" {
  type UserId = string;
  // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
  interface KnownEvents {
    [key: `fight.join.${UserId}`]: Message;
  }
}

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

      if (!opponent || opponent.isDeleted) {
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

      if (existingFight.length > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "You already have an ongoing fight",
        });
      }

      const newFight = await ctx.db.transaction(async (tx) => {
        const newFights = await tx
          .insert(fight)
          // todo: implement game selection
          .values({ game: "rock-paper-scissors" })
          .returning({ id: fight.id, game: fight.game });
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

      const event = {
        fightId: newFight.id,
        game: newFight.game,
      };
      // both values are checked to be non-null by validating isDeleted
      [ctx.user.clerkId!, opponent.clerkId!].forEach((player) => {
        ctx.ee.emit(`fight.join.${player}`, event);
      });

      return {
        id: newFight.id,
      };
    }),

  canJoin: userProcedure
    .input(z.object({ id: z.string() }))
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

  onInvite: publicProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .subscription(({ ctx, input }) => {
      return observable<Message>((emit) => {
        function onMessage(data: Message) {
          emit.next(data);
        }

        ctx.ee.on(`fight.join.${input.id}`, onMessage);

        return () => {
          ctx.ee.off(`fight.join.${input.id}`, onMessage);
        };
      });
    }),
});
