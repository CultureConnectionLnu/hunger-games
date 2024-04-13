import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  playerProcedure,
} from "~/server/api/trpc";
import type { BaseGamePlayerEvents } from "../logic/core/base-game";
import { FightHandler } from "../logic/fight";

type JoinMessage = {
  type: 'join'
  fightId: string;
  game: string;
};
type EndMessage = {
  type: 'end'
  fightId: string;
};
declare module "~/lib/event-emitter" {
  type UserId = string;
  type FightId = string;
  // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
  interface KnownEvents {
    [key: `fight.join.${UserId}`]: JoinMessage;
    [key: `fight.end.${UserId}`]: EndMessage;
  }
}

/**
 * makes sure that a user is in a fight
 */
export const inFightProcedure = playerProcedure.use(async ({ ctx, next }) => {
  const currentFight = await FightHandler.instance.getCurrentFight(
    ctx.user.clerkId,
  );

  const fight = FightHandler.instance.getFight(currentFight.fightId);
  if (!fight) {
    // TODO: introduce delete action for the invalid fight
    console.error(
      `Could not find the fight with id '${currentFight.fightId}' in the GameHandler`,
    );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Could not find your match, even though it should exist",
    });
  }

  return next({
    ctx: {
      ...ctx,
      currentFight,
      fight,
      fightHandler: FightHandler.instance,
    },
  });
});

export function catchMatchError(fn: () => void) {
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

export const fightRouter = createTRPCRouter({
  create: playerProcedure
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

  currentFight: playerProcedure.query(async ({ ctx }) => {
    try {
      return {
        fight: await FightHandler.instance.getCurrentFight(ctx.user.clerkId),
        success: true,
      } as const;
    } catch (error) {
      return { success: false } as const;
    }
  }),

  join: inFightProcedure.query(({ ctx }) => {
    catchMatchError(() => {
      ctx.fight.lobby.playerJoin(ctx.user.clerkId);
    });
    return true;
  }),

  ready: inFightProcedure.mutation(({ ctx }) => {
    catchMatchError(() => {
      ctx.fight.lobby.playerReady(ctx.user.clerkId);
    });
    return true;
  }),

  onGameAction: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        fightId: z.string().uuid(),
      }),
    )
    .subscription(({ input }) => {
      return observable<BaseGamePlayerEvents>((emit) => {
        const match = FightHandler.instance.getFight(input.fightId)?.lobby;
        if (match?.getPlayer(input.userId) === undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Match not found",
          });
        }
        const onMessage = (data: BaseGamePlayerEvents) => {
          emit.next(data);
        };
        match.on(`player-${input.userId}`, onMessage);
        (match.getEventHistory(input.userId) as BaseGamePlayerEvents[]).forEach(
          onMessage,
        );

        match.once("destroy", () => {
          emit.complete();
        });

        match.playerConnect(input.userId);

        return () => {
          match.off(`player-${input.userId}`, onMessage);
          match.playerDisconnect(input.userId);
        };
      });
    }),

  onFightUpdate: publicProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .subscription(({ ctx, input }) => {
      type Messages = JoinMessage | EndMessage;
      return observable<Messages>((emit) => {
        function onMessage(data: Messages) {
          emit.next(data);
        }

        ctx.ee.on(`fight.join.${input.id}`, onMessage);
        ctx.ee.on(`fight.end.${input.id}`, onMessage);

        return () => {
          ctx.ee.off(`fight.join.${input.id}`, onMessage);
          ctx.ee.off(`fight.end.${input.id}`, onMessage);
        };
      });
    }),
});
