import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { FightHandler } from "../../logic/fight";
import { catchMatchError, inFightProcedure } from "../fight";
import {
  type RockPaperScissorsEvents,
  rockPaperScissorsItemsSchema,
} from "../../logic/games/rps";
import type { OnlyPlayerEvents } from "../../logic/core/types";
import { type TypingEvents } from "../../logic/games/typing";

export type TypingPlayerEvents = OnlyPlayerEvents<TypingEvents>;

/**
 * makes sure the user is actually in a rock-paper-scissors fight
 */
const typingProcedure = inFightProcedure.use(({ ctx, next }) => {
  if (ctx.currentFight.game !== "typing") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid game type",
    });
  }

  if (ctx.fight.type !== "typing") {
    // TODO: introduce delete action for the invalid fight
    console.error(
      `The fight with id '${ctx.currentFight.fightId}' is not of type 'typing', even though it is supposed to be.`,
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

export const typingRouter = createTRPCRouter({
  //   choose: typingProcedure // we will get back to
  //     .input(rockPaperScissorsItemsSchema)
  //     .mutation(({ ctx, input }) => {
  //       catchMatchError(() => {
  //         ctx.currentGame.playerChoose(ctx.user.clerkId, input);
  //       });
  //       return true;
  //     }),

  typingCharacterInput: typingProcedure
    .input(
      z.object({
        char: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      //   await new Promise((resolve) => setTimeout(resolve, 500));
      ctx.currentGame.typeCharacter(input.char);
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
      return observable<TypingPlayerEvents>((emit) => {
        const match = FightHandler.instance.getFight(input.fightId)?.game;
        if (match?.getPlayer(input.userId) === undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Match not found",
          });
        }

        const onMessage = (data: TypingPlayerEvents) => {
          emit.next(data);
        };
        match.on(`player-${input.userId}`, onMessage);
        (match.getEventHistory(input.userId) as TypingPlayerEvents[]).forEach(
          onMessage,
        );

        match.once("destroy", () => {
          emit.complete();
        });

        return () => {
          match.off(`player-${input.userId}`, onMessage);
        };
      });
    }),
});
