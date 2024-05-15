import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { catchMatchError, inFightProcedure } from "../lobby";
import type { OnlyPlayerEvents } from "../../logic/core/types";
import { lobbyHandler } from "../../logic/handler";
import { type OrderedMemoryEvents } from "../../logic/games/om";

export type OrderedMemoryPlayerEvents = OnlyPlayerEvents<OrderedMemoryEvents>;

/**
 * makes sure the user is actually in a ordered-memory fight
 */
const orderedMemoryProcedure = inFightProcedure.use(({ ctx, next }) => {
  if (ctx.currentFight.game !== "ordered-memory") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid game type",
    });
  }

  if (ctx.fight.type !== "ordered-memory") {
    // TODO: introduce delete action for the invalid fight
    console.error(
      `The fight with id '${ctx.currentFight.fightId}' is not of type 'ordered-memory', even though it is supposed to be.`,
    );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not find your match, even though it should exist",
    });
  }
  return next({
    ctx: {
      currentGame: ctx.fight.game,
    },
  });
});

export const orderedMemoryRouter = createTRPCRouter({
  clickCard: orderedMemoryProcedure
    .input(
      z.object({
        col: z.number(),
        row: z.number(),
      }),
    )
    .mutation(({ ctx, input }) => {
      catchMatchError(() => {
        ctx.currentGame.playerClick(ctx.user.clerkId, input);
      });
      return true;
    }),

  onAction: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        fightId: z.string().uuid(),
      }),
    )
    .subscription(({ input }) => {
      return observable<OrderedMemoryPlayerEvents>((emit) => {
        const lobby = lobbyHandler.getFight(input.fightId);
        if (!lobby) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Match not found",
          });
        }
        if (lobby.type !== "ordered-memory") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid game type",
          });
        }
        if (lobby.game.getPlayer(input.userId) === undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Match not found",
          });
        }

        const onMessage = (data: OrderedMemoryPlayerEvents) => {
          emit.next(data);
        };
        lobby.game.on(`player-${input.userId}`, onMessage);
        (
          lobby.game.getEventHistory(
            input.userId,
          ) as OrderedMemoryPlayerEvents[]
        ).forEach(onMessage);

        lobby.game.once("destroy", () => {
          emit.complete();
        });

        return () => {
          lobby.game.off(`player-${input.userId}`, onMessage);
        };
      });
    }),
});
