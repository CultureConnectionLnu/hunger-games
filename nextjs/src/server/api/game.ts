"use server";

import { z } from "zod";
import { clerk } from "../auth/clerk";
import { ApiError, endpoint } from "./helper";
import { service } from "../service";
import { db } from "../db";
import { match, userToMatch } from "../db/schema";
import { eq, sql } from "drizzle-orm";

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

    const players = [user.userId, opponentId] satisfies [string, string];
    // todo: introduce a function that returns a random game type

    const gameType = "rock-paper-scissors";
    const matchId = await db.transaction(async (tx) => {
      const [newMatch] = await tx
        .insert(match)
        .values({ game: gameType })
        .returning({ id: match.id });

      if (!newMatch) {
        tx.rollback();
        throw new ApiError("Failed to create new fight", "InternalServerError");
      }

      await tx.insert(userToMatch).values(
        players.map((player) => ({
          clerkId: player,
          matchId: newMatch.id,
        })),
      );
      return newMatch.id;
    });

    await service.activeGames.createNewGame(
      matchId,
      gameType,
      players,
      async (outcome) => {
        if (outcome.result === "ongoing") {
          // should not happen here, this is only to make typescript happy
          console.error(
            "onGameComplete called, even though the game was not completed",
            matchId,
          );
          return;
        }
        void db
          .update(match)
          .set({
            reason: outcome.reason,
            result: outcome.result,
            winner: outcome.winnerId,
          })
          .where(eq(match.id, matchId));
      },
    );
  },
);

export const getAllMyMatches = endpoint(
  {
    auth: "player",
  },
  async (_, user) =>
    db
      .select({
        matchId: match.id,
        game: match.game,
        youWon: sql<boolean>`CASE WHEN ${match.winner} = ${user.userId} THEN true ELSE false END`,
        result: match.result,
        reason: match.reason,
        opponentId: sql<string>`
          (SELECT ${userToMatch.clerkId}
           FROM ${userToMatch} 
           WHERE ${userToMatch.matchId} = ${match.id} AND ${userToMatch.clerkId} != ${user.userId}
           LIMIT 1)`,
      })
      .from(match)
      .innerJoin(userToMatch, eq(match.id, userToMatch.matchId))
      .where(eq(userToMatch.clerkId, user.userId)),
);
