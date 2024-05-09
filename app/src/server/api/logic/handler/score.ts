import { and, desc, eq, not, sql, sum } from "drizzle-orm";
import { type DB, db } from "~/server/db";
import { fight, score, usersToFight } from "~/server/db/schema";
import { type KnownGames } from "./lobby";
import { fightScoringConfig, questScoringConfig } from "../config";
import { getHandler } from "./base";
import { type QuestKind } from "./quest";

class ScoreHandler {
  public async currentScore(userId: string) {
    const totalScore = await db
      .select({
        score: sum(score.score),
      })
      .from(score)
      .where(eq(score.userId, userId));

    return Number(totalScore[0]?.score ?? 0);
  }

  public async updateScoreForFight(
    winnerId: string,
    looserId: string,
    fightId: string,
  ) {
    try {
      const currentLooserScore = await this.currentScore(looserId);
      const { looserSubtraction, winnerAddition } =
        this.calculateScoreEntries(currentLooserScore);
      await db.insert(score).values([
        {
          fightId,
          score: looserSubtraction,
          userId: looserId,
        },
        {
          fightId,
          score: winnerAddition,
          userId: winnerId,
        },
      ]);
    } catch (error) {
      console.error(`Could not update score for fight ${fightId}`, error);
    }
  }

  public async updateScoreForQuest(
    tx: DB,
    userId: string,
    questId: string,
    questKind: QuestKind,
  ) {
    const questScore = questScoringConfig[questKind];
    return tx.insert(score).values({
      questId,
      score: questScore,
      userId,
    });
  }

  public async getDashboard() {
    return await db
      .select({
        rank: sql<number>`CAST(RANK() OVER (ORDER BY SUM(${score.score}) DESC) AS INTEGER)`,
        score: sum(score.score),
        userId: score.userId,
      })
      .from(score)
      .groupBy(score.userId)
      .orderBy(desc(sum(score.score)));
  }

  public async getHistory(playerId: string) {
    return db
      .select({
        fightId: score.fightId,
        questId: score.questId,
        scoreChange: score.score,
        score: sql<number>`CAST(SUM(${score.score}) OVER (PARTITION BY ${score.userId} ORDER BY ${fight.createdAt}) AS INTEGER)`,
      })
      .from(score)
      .where(eq(score.userId, playerId))
      .orderBy(desc(score.createdAt));
  }

  public async getCurrentScore(playerId: string) {
    return db
      .select({
        score: sum(score.score),
      })
      .from(score)
      .where(eq(score.userId, playerId));
  }

  public async getHistoryEntry(userId: string, fightId: string) {
    const queryResult = await db
      .select({
        userId: score.userId,
        fightId: fight.id,
        game: fight.game,
        score: score.score,
        winner: fight.winner,
      })
      .from(score)
      .innerJoin(fight, eq(score.fightId, fight.id))
      .leftJoin(
        usersToFight,
        and(
          eq(fight.id, usersToFight.fightId),
          not(eq(usersToFight.userId, score.userId)),
        ),
      )
      .where(eq(score.fightId, fightId));

    if (queryResult.length === 0) {
      return { success: false } as const;
    }
    if (queryResult.length !== 2) {
      console.error(
        `Found ${queryResult.length} history entry results for the user ${userId} and fight ${fightId}, which should be impossible`,
      );
      return { success: false } as const;
    }
    if (!queryResult.some((x) => x.userId === userId)) {
      // userId is not used in the query, so data is retrieved even though the user may not have access to it.
      // Therefore a manual check is needed
      return { success: false } as const;
    }

    const data = queryResult.reduce(
      (entry, result) => {
        entry.youWon = result.winner === userId;
        entry.game = result.game as KnownGames;

        if (result.winner === result.userId) {
          entry.winnerScore = result.score;
          entry.winnerId = result.userId;
        }

        if (result.winner !== result.userId) {
          entry.looserScore = result.score;
          entry.looserId = result.userId;
        }

        return entry;
      },
      {} as {
        winnerId: string;
        looserId: string;
        winnerScore: number;
        looserScore: number;
        youWon: boolean;
        game: KnownGames;
      },
    );

    return {
      success: true,
      data,
    } as const;
  }

  public async getScoreFromGame(fight: string, user: string) {
    const score = await db.query.score.findFirst({
      where: ({ fightId, userId }) => and(eq(fightId, fight), eq(userId, user)),
    });
    if (!score) {
      return { success: false } as const;
    }
    return { success: true, score: score.score };
  }

  private calculateScoreEntries(looserCurrentScore: number) {
    const reducePointsBy =
      (looserCurrentScore * fightScoringConfig.winnerGetsPercent) / 100;
    const winnerAddition = Math.max(
      fightScoringConfig.winnerMinimumPointsBonus,
      reducePointsBy,
    );

    const newLooserScore = looserCurrentScore - reducePointsBy;
    if (newLooserScore < fightScoringConfig.lowestScore) {
      return {
        // the result would be 0 then
        looserSubtraction: -looserCurrentScore,
        winnerAddition: looserCurrentScore,
      };
    }

    return {
      looserSubtraction: -reducePointsBy,
      winnerAddition,
    };
  }
}

declare global {
  interface HungerGamesHandlers {
    score?: ScoreHandler;
  }
}

export const scoreHandler = getHandler("score", () => new ScoreHandler());
