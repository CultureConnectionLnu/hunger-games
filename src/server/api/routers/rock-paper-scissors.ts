import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  type AnyGameEvent,
  rockPaperScissorsItemsSchema,
} from "../logic/rock-paper-scissors";
import { inFightProcedure } from "./fight";
import { FightHandler } from "../logic/fight";

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

  const currentGame = ctx.fightHandler.getGame(ctx.currentFight.fightId);
  if (!currentGame) {
    // TODO: introduce delete action for the invalid fight
    console.error(
      `Could not find the fight with id '${ctx.currentFight.fightId}' in the GameHandler`,
    );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not find your match, even though it should exist",
    });
  }

  if (currentGame.type !== "rock-paper-scissors") {
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
      ...ctx,
      currentGame: currentGame.instance,
    },
  });
});

function catchMatchError(fn: () => void) {
  try {
    fn();
  } catch (error) {
    if (error instanceof Error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: error.message,
      });
    }
    const errorId = randomUUID();
    console.error("Error id: " + errorId, error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message:
        "Could not interact with rock paper scissors match. For more details, check the logs with error id: " +
        errorId,
    });
  }
}

export const rockPaperScissorsRouter = createTRPCRouter({
  join: rockPaperScissorsProcedure.query(({ ctx }) => {
    catchMatchError(() => {
      ctx.currentGame.playerJoin(ctx.user.clerkId);
    });
    return true;
  }),
  ready: rockPaperScissorsProcedure.mutation(({ ctx }) => {
    catchMatchError(() => {
      ctx.currentGame.playerReady(ctx.user.clerkId);
    });
    return true;
  }),
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
      return observable<AnyGameEvent>((emit) => {
        const match = FightHandler.instance.getGame(input.fightId)?.instance;
        if (!match || !match.players.includes(input.userId)) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Match not found",
          });
        }

        function onMessage(data: AnyGameEvent) {
          emit.next(data);
        }
        match.on("event", onMessage);
        match.allEvents.forEach(onMessage);

        match.once("destroy", () => {
          emit.complete();
        });

        return () => {
          match.off("event", onMessage);
        };
      });
    }),
});
