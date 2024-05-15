import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import { clerkHandler, ee, gameStateHandler } from "../logic/handler";
import {
  createTRPCRouter,
  errorBoundary,
  medicProcedure,
  publicProcedure,
} from "../trpc";

type WoundedPlayer = Awaited<
  ReturnType<(typeof gameStateHandler)["getWoundedPlayer"]>
>;

declare module "~/lib/event-emitter" {
  // eslint-disable-next-line @typescript-eslint/consistent-indexed-object-style
  interface KnownEvents {
    [key: `player-wounded-update.${UserId}`]: WoundedPlayer;
  }
}

export const medicRouter = createTRPCRouter({
  getAllWounded: medicProcedure.query(() =>
    errorBoundary(async () => {
      const allWoundedPlayerIds = await gameStateHandler.getAllWoundedPlayers();
      const userNames = await clerkHandler.getUserNames(
        allWoundedPlayerIds.map(({ userId }) => userId),
      );

      return allWoundedPlayerIds.map((player) => ({
        ...player,
        userName: userNames[player.userId]!,
      }));
    }),
  ),

  startRevive: medicProcedure
    .input(
      z.object({
        playerId: z.string(),
      }),
    )
    .mutation(({ input }) =>
      errorBoundary(async () => {
        const { success, error } = await gameStateHandler.startRevivingPlayer(
          input.playerId,
        );
        if (!success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error,
          });
        }
        void gameStateHandler
          .getWoundedPlayer(input.playerId)
          .then((x) => ee.emit(`player-wounded-update.${input.playerId}`, x));
        return true;
      }),
    ),

  finishRevive: medicProcedure
    .input(
      z.object({
        playerId: z.string(),
      }),
    )
    .mutation(({ input }) =>
      errorBoundary(async () => {
        const { success, error } = await gameStateHandler.finishRevivingPlayer(
          input.playerId,
        );
        if (!success) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error,
          });
        }
        void gameStateHandler
          .getWoundedPlayer(input.playerId)
          .then((x) => ee.emit(`player-wounded-update.${input.playerId}`, x));
        return true;
      }),
    ),

  onWoundedUpdate: publicProcedure
    .input(
      z.object({
        playerId: z.string(),
      }),
    )
    .subscription(({ input }) => {
      return observable<WoundedPlayer>((emit) => {
        function onMessage(data: WoundedPlayer) {
          emit.next(data);
        }

        ee.on(`player-wounded-update.${input.playerId}`, onMessage);

        return () => {
          ee.off(`player-wounded-update.${input.playerId}`, onMessage);
        };
      });
    }),
});
