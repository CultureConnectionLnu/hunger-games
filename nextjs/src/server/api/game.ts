"use server";

import { z } from "zod";
import { clerk } from "../auth/clerk";
import { dbErrorBoundary, endpoint } from "./helper";
import { service } from "../service";
import { db } from "../db";
import { match, userToMatch } from "../db/schema";
import { eq, sql } from "drizzle-orm";
import { ok, err } from "neverthrow";

export const startGame = endpoint(
  {
    validation: z.object({
      opponentId: z.string(),
    }),
    auth: "player",
  },
  async ({ opponentId }, user) => {
    if (user.userId === opponentId) {
      return err({
        code: "BAD_REQUEST",
        reason: "CANNOT_PLAY_AGAINST_YOURSELF",
      });
    }

    const opponentResult = await clerk.getUser(opponentId);
    if (opponentResult.isErr()) {
      return err({
        code: "BAD_REQUEST",
        reason: "OPPONENT_NOT_FOUND",
      });
    }
    const opponent = opponentResult.value;

    if (clerk.hasRole(opponent, "player") === false) {
      return err({
        code: "BAD_REQUEST",
        reason: "OPPONENT_IS_NOT_A_PLAYER",
      });
    }

    if (service.activeGames.getActiveGameOfPlayer(user.userId) !== undefined) {
      return err({
        code: "BAD_REQUEST",
        reason: "YOU_ARE_ALREADY_IN_GAME",
      });
    }

    if (service.activeGames.getActiveGameOfPlayer(opponentId) !== undefined) {
      return err({
        code: "BAD_REQUEST",
        reason: "OPPONENT_IS_ALREADY_IN_GAME",
      });
    }

    const players = [user.userId, opponentId] satisfies [string, string];
    // todo: introduce a function that returns a random game type

    const gameType = "rock-paper-scissors";
    const matchId = await db.transaction(async (tx) => {
      const newMatchResult = await dbErrorBoundary(
        tx.insert(match).values({ game: gameType }).returning({ id: match.id }),
        "DB_UNABLE_TO_CREATE_NEW_MATCH",
      );

      if (newMatchResult.isErr()) {
        tx.rollback();
        return err(newMatchResult.error);
      }
      const [newMatch] = newMatchResult.value;
      if (newMatch === undefined) {
        tx.rollback();
        return err("DB_EMPTY_NEW_MATCH_ID");
      }

      const userToMatchResult = await dbErrorBoundary(
        tx.insert(userToMatch).values(
          players.map((player) => ({
            clerkId: player,
            matchId: newMatch.id,
          })),
        ),
        "DB_UNABLE_TO_CREATE_USER_TO_MATCH_ENTRIES",
      );
      if (userToMatchResult.isErr()) {
        tx.rollback();
        return err(userToMatchResult.error);
      }
      return ok(newMatch.id);
    });

    if (matchId.isErr()) {
      return err({
        code: "INTERNAL_SERVER_ERROR",
        reason: matchId.error,
      });
    }

    await service.activeGames.createNewGame(
      matchId.value,
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
          .where(eq(match.id, matchId.value));
      },
    );
    return ok(matchId.value);
  },
);

export const getAllMyMatches = endpoint(
  {
    auth: "player",
  },
  async (_, user) => {
    const result = await dbErrorBoundary(
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
      "DB_UNABLE_TO_GET_ALL_MY_MATCHES",
    );
    if (result.isErr()) {
      return err({
        code: "INTERNAL_SERVER_ERROR",
        reason: result.error,
      });
    }
    return ok(result.value);
  },
);
