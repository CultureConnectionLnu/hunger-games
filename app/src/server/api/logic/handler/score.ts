import { and, desc, eq, sql, sum } from "drizzle-orm";
import { db, type DB } from "~/server/db";
import { fight, score, usersToFight } from "~/server/db/schema";
import { fightScoringConfig, questScoringConfig } from "../config";
import { getHandler } from "./base";
import { type KnownGames } from "./lobby";
import { type WalkQuestKind } from "./quest";

type FightEntry =
  | {
      yourId: string;
      opponentId: string;
      yourScore: number;
      opponentScore: number;
      youWon: boolean;
      outcome: "completed";
      game: KnownGames;
    }
  | {
      yourId: string;
      opponentId: string;
      youWon: boolean;
      outcome: "aborted";
      game: KnownGames;
    }
  | {
      yourId: string;
      opponentId: string;
      youWon: boolean;
      outcome: "in-progress";
      game: KnownGames;
    };

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
    loserId: string,
    fightId: string,
  ) {
    try {
      const currentLoserScore = await this.currentScore(loserId);
      const { loserSubtraction, winnerAddition } =
        this.calculateScoreEntries(currentLoserScore);
      const scoreUpdates = [
        {
          fightId,
          score: loserSubtraction,
          userId: loserId,
        },
        {
          fightId,
          score: winnerAddition,
          userId: winnerId,
        },
      ];
      console.log("after fight score updates", scoreUpdates);
      await db.insert(score).values(scoreUpdates);
    } catch (error) {
      console.error(`Could not update score for fight ${fightId}`, error);
    }
  }

  public async updateScoreForWalkQuest(
    tx: DB,
    userId: string,
    questId: string,
    questKind: WalkQuestKind,
  ) {
    const questScore = questScoringConfig[questKind];
    return tx.insert(score).values({
      questId,
      score: questScore,
      userId,
    });
  }

  public async updateScoreForAssignQuest(
    tx: DB,
    userId: string,
    questId: string,
    points: number,
  ) {
    return tx.insert(score).values({
      questId,
      score: points,
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

  public async getFightDetails(userId: string, fightId: string) {
    const queryResult = await db
      .select({
        userId: usersToFight.userId,
        fightId: fight.id,
        game: fight.game,
        score: score.score,
        winner: fight.winner,
        outcome: fight.outcome,
      })
      .from(fight)
      .leftJoin(usersToFight, eq(fight.id, usersToFight.fightId))
      .leftJoin(
        score,
        and(eq(fight.id, score.fightId), eq(usersToFight.userId, score.userId)),
      )
      .where(eq(fight.id, fightId));

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

    const data = queryResult.reduce((entry, result) => {
      entry.youWon = result.winner === userId;
      entry.game = result.game as KnownGames;
      entry.outcome = result.outcome ?? "in-progress";

      if (result.userId === userId) {
        entry.yourId = userId;
        if (entry.outcome === "completed") entry.yourScore = result.score!;
      } else {
        entry.opponentId = result.userId!;
        if (entry.outcome === "completed") entry.opponentScore = result.score!;
      }

      return entry;
    }, {} as FightEntry);

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

  private calculateScoreEntries(loserCurrentScore: number) {
    const reducePointsBy = Math.trunc(
      (loserCurrentScore * fightScoringConfig.winnerGetsPercent) / 100,
    );
    const winnerAddition = Math.max(
      fightScoringConfig.winnerMinimumPointsBonus,
      reducePointsBy,
    );

    const newLoserScore = loserCurrentScore - reducePointsBy;
    if (newLoserScore < fightScoringConfig.lowestScore) {
      return {
        // the result would be 0 then
        loserSubtraction: -loserCurrentScore,
        winnerAddition: loserCurrentScore,
      };
    }

    return {
      loserSubtraction: -reducePointsBy,
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
