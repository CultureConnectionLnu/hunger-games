import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  createTRPCRouter,
  errorBoundary,
  playerProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import type { BaseGamePlayerEvents } from "../logic/core/base-game";
import { ee, lobbyHandler, userHandler } from "../logic/handler";
import { gameStateHandler } from "../logic/handler/game-state";

type JoinMessage = {
  type: "join";
  fightId: string;
  game: string;
};
type EndMessage = {
  type: "end";
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
  const currentFight = await lobbyHandler.assertCurrentFight(ctx.user.clerkId);

  const fight = lobbyHandler.getFight(currentFight.fightId);
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
      playerId: ctx.user.clerkId,
      currentFight,
      fight,
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

export const lobbyRouter = createTRPCRouter({
  create: playerProcedure
    .input(
      z.object({
        opponent: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const opponent = await lobbyHandler.getOpponent(input.opponent);

      if (!opponent || opponent.isDeleted) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Opponent not found",
        });
      }
      await userHandler.assertUserIsPlayer(
        opponent.clerkId,
        `The opponent with id '${opponent.clerkId}' is no player and can't start a fight`,
      );
      await gameStateHandler.assertPlayerNotWounded(
        opponent.clerkId,
        `The opponent with id '${opponent.clerkId}' is wounded and can't start a fight`,
      );

      await lobbyHandler.assertHasNoFight(ctx.user.clerkId);
      const newFight = await lobbyHandler.createFight(
        ctx.user.clerkId,
        opponent.clerkId,
      );

      const players = [ctx.user.clerkId, opponent.clerkId];
      players.forEach((player) => {
        ee.emit(`fight.join.${player}`, {
          type: "join",
          fightId: newFight.lobby.fightId,
          game: newFight.type,
        });
      });

      newFight.lobby.on("game-ended", () => {
        players.forEach((player) => {
          ee.emit(`fight.end.${player}`, {
            type: "end",
            fightId: newFight.lobby.fightId,
          });
        });
      });

      console.log("New fight", {
        id: newFight.lobby.fightId,
        game: newFight.type,
        players: [ctx.user.clerkId, opponent.clerkId],
      });

      return {
        id: newFight.lobby.fightId,
      };
    }),

  currentFight: playerProcedure.query(async ({ ctx }) => {
    try {
      return {
        fight: await lobbyHandler.assertCurrentFight(ctx.user.clerkId),
        success: true,
      } as const;
    } catch (error) {
      console.error(
        `[Lobby:currentFight]: loading the current fight failed: ${String(error)}`,
        error,
      );
      return { success: false } as const;
    }
  }),

  getAllMyFights: playerProcedure.query(({ ctx }) =>
    errorBoundary(async () =>
      lobbyHandler.getAllFightsOfPlayer(ctx.user.clerkId),
    ),
  ),

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
        const match = lobbyHandler.getFight(input.fightId)?.lobby;
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

        lobbyHandler
          .assertCurrentFight(input.id)
          .then(({ fightId, game }) => {
            onMessage({
              type: "join",
              fightId,
              game,
            });
          })
          .catch(() => {
            // do nothing, because no fight exists
          });

        ee.on(`fight.join.${input.id}`, onMessage);
        ee.on(`fight.end.${input.id}`, onMessage);

        return () => {
          ee.off(`fight.join.${input.id}`, onMessage);
          ee.off(`fight.end.${input.id}`, onMessage);
        };
      });
    }),
});
