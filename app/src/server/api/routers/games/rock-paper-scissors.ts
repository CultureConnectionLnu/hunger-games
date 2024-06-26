import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { catchMatchError, inFightProcedure } from "../lobby";
import {
  type RockPaperScissorsEvents,
  rockPaperScissorsItemsSchema,
} from "../../logic/games/rps";
import type { OnlyPlayerEvents } from "../../logic/core/types";
import { lobbyHandler } from "../../logic/handler";

export type RockPaperScissorsPlayerEvents =
  OnlyPlayerEvents<RockPaperScissorsEvents>;

/**
 * makes sure the user is actually in a rock-paper-scissors fight
 */
const rockPaperScissorsProcedure = inFightProcedure.use(({ ctx, next }) => {
  if (ctx.currentFight.game !== "rock-paper-scissors") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid game type",
    });
  }

  if (ctx.fight.type !== "rock-paper-scissors") {
    // TODO: introduce delete action for the invalid fight
    console.error(
      `The fight with id '${ctx.currentFight.fightId}' is not of type 'rock-paper-scissors', even though it is supposed to be.`,
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

export const rockPaperScissorsRouter = createTRPCRouter({
  choose: rockPaperScissorsProcedure
    .input(rockPaperScissorsItemsSchema)
    .mutation(({ ctx, input }) => {
      catchMatchError(() => {
        ctx.currentGame.playerChoose(ctx.user.clerkId, input);
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
      return observable<RockPaperScissorsPlayerEvents>((emit) => {
        const lobby = lobbyHandler.getFight(input.fightId);
        if (!lobby) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Match not found",
          });
        }
        if (lobby.type !== "rock-paper-scissors") {
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

        const onMessage = (data: RockPaperScissorsPlayerEvents) => {
          emit.next(data);
        };
        lobby.game.on(`player-${input.userId}`, onMessage);
        (
          lobby.game.getEventHistory(
            input.userId,
          ) as RockPaperScissorsPlayerEvents[]
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
