import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { randomUUID } from "crypto";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  type AnyGameEvent,
  RockPaperScissorsHandler,
  rockPaperScissorsItemsSchema,
} from "../logic/rock-paper-scissors";
import { fightProcedure } from "./fight";

/**
 * makes sure the user is actually in a rock-paper-scissors fight
 */
const rockPaperScissorsProcedure = fightProcedure.use(({ ctx, next }) => {
  if (ctx.currentFight.game !== "rock-paper-scissors") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid game",
    });
  }
  return next({
    ctx: {
      ...ctx,
      currentMatch: RockPaperScissorsHandler.instance.getOrCreateMatch({
        fightId: ctx.currentFight.fightId,
        players: ctx.currentFight.players,
      }),
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
      ctx.currentMatch.playerJoin(ctx.user.clerkId);
    });
  }),
  ready: rockPaperScissorsProcedure.mutation(({ ctx }) => {
    catchMatchError(() => {
      ctx.currentMatch.playerReady(ctx.user.clerkId);
    });
  }),
  choose: rockPaperScissorsProcedure
    .input(rockPaperScissorsItemsSchema)
    .mutation(({ ctx, input }) => {
      catchMatchError(() => {
        ctx.currentMatch.playerChoose(ctx.user.clerkId, input);
      });
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
        const match = RockPaperScissorsHandler.instance.getMatch(input.fightId);
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

        return () => {
          match.off("event", onMessage);
        };
      });
    }),
});
