import { z } from "zod";
import { clerkHandler } from "../logic/handler";
import { gameStateHandler } from "../logic/handler/game-state";
import {
  createTRPCRouter,
  errorBoundary,
  medicProcedure,
  playerProcedure,
} from "../trpc";
import { TRPCError } from "@trpc/server";

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
        return true;
      }),
    ),

  getMyWoundedState: playerProcedure.query(({ ctx }) =>
    errorBoundary(async () =>
      gameStateHandler.getWoundedPlayer(ctx.user.clerkId),
    ),
  ),
});
