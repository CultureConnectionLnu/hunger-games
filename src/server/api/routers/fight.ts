import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import {
  createTRPCRouter,
  publicProcedure,
  userProcedure,
} from "~/server/api/trpc";
import { FightHandler } from "../logic/fight";
import {
  type BaseGamePlayerEvents,
  BaseGameState,
} from "../logic/core/base-game-state";
import { randomUUID } from "crypto";

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
  const currentFight = await FightHandler.instance.getCurrentFight(
    ctx.user.clerkId,
  );

  const game = FightHandler.instance.getGame(currentFight.fightId);
  if (!game) {
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
      game,
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

  currentFight: userProcedure.query(async ({ ctx }) => {
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
      ctx.game.instance.playerJoin(ctx.user.clerkId);
    });
    return true;
  }),

  ready: inFightProcedure.mutation(({ ctx }) => {
    catchMatchError(() => {
      ctx.game.instance.playerReady(ctx.user.clerkId);
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
      return observable<BaseGamePlayerEvents>((emit) => {
        const match = FightHandler.instance.getGame(input.fightId)?.instance as
          | BaseGameState
          | undefined;
        if (match?.getPlayer(input.userId) === undefined) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Match not found",
          });
        }
        const onMessage = (data: BaseGamePlayerEvents) => {
          //todo: emit event in a way that this filtering is not needed
          if (!BaseGameState.playerSpecificEvents.includes(data.event)) return;
          emit.next(data);
        };
        match.on(`player-${input.userId}`, onMessage);
        // replay events
        match.getEventHistory(input.userId).forEach(onMessage);

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
