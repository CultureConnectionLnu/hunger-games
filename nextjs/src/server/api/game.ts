"use server";

import { z } from "zod";
import { clerk } from "../auth/clerk";
import { ApiError, endpoint } from "./helper";
import { service } from "../service";

export const startGame = endpoint(
  {
    validation: z.object({
      opponentId: z.string(),
    }),
    auth: "player",
  },
  async ({ opponentId }, user) => {
    if (user.userId === opponentId) {
      throw new ApiError("You cannot play against yourself", "BadRequest");
    }

    const opponent = await clerk.getUser(opponentId);
    if (opponent === undefined) {
      throw new ApiError("Invalid opponent id", "BadRequest");
    }

    if (clerk.hasRole(opponent, "player") === false) {
      throw new ApiError("Opponent is not a player", "BadRequest");
    }

    //   todo: update db
    const id = crypto.randomUUID();
    await service.activeGames.createNewGame(
      id,
      "rock-paper-scissors",
      [user.userId, opponentId],
      async () => {
        //   todo: update db
        console.log("game completed");
      },
    );
  },
);
