import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  userProcedure,
} from "~/server/api/trpc";
import { FightHandler } from "../logic/fight";

const messageSchema = z.object({
  fightId: z.string().uuid(),
  game: z.string(),
  players: z.array(z.string()).min(2).max(2),
});
type Message = Pick<z.TypeOf<typeof messageSchema>, "fightId" | "game">;

declare module "~/lib/event-emitter" {
  type UserId = string;
  type FightId = string;
  // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
  interface KnownEvents {
    [key: `fight.join.${UserId}`]: Message;
  }
}

/**
 * makes sure that a user is in a fight
 */
export const inFightProcedure = userProcedure.use(async ({ ctx, next }) => {
  return next({
    ctx: {
      ...ctx,
      currentFight: await FightHandler.instance.getCurrentFight(ctx.user.clerkId),
      fightHandler: FightHandler.instance,
    },
  });
});

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

      await FightHandler.instance.assertHasNoFight(ctx.user.clerkId);
      const newFight = await FightHandler.instance.createFight(
        ctx.user.clerkId,
        opponent.clerkId,
      );

      const event = {
        fightId: newFight.id,
        game: newFight.game,
      };
      [ctx.user.clerkId, opponent.clerkId].forEach((player) => {
        ctx.ee.emit(`fight.join.${player}`, event);
      });

      console.log("New fight", {
        id: newFight.id,
        game: newFight.game,
        players: [ctx.user.clerkId, opponent.clerkId],
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
        (participant) => participant.userId === ctx.user.clerkId,
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
