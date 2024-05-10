import { clerkHandler } from "../logic/handler";
import { gameStateHandler } from "../logic/handler/game-state";
import { createTRPCRouter, errorBoundary, medicProcedure } from "../trpc";

export const medicRouter = createTRPCRouter({
  getAllWounded: medicProcedure.query(() =>
    errorBoundary(async () => {
      const allWoundedPlayerIds = await gameStateHandler.getAllWoundedPlayers();
      const userNames = await clerkHandler.getUserNames(
        allWoundedPlayerIds.map(({ userId }) => userId),
      );

      return allWoundedPlayerIds.map((player) => ({
        ...player,
        userName: userNames[player.userId],
      }));
    }),
  ),
});
