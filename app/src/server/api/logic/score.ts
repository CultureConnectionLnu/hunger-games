import { and, desc, eq, not, sql, sum } from "drizzle-orm";
import { db, type DB } from "~/server/db";
import { fight, score, usersToFight } from "~/server/db/schema";
import { type KnownGames } from "./fight";

export const staticScoringConfig = {
  lowestScore: 0,
  winnerGetsPercent: 50,
  winnerMinimumPointsBonus: 100,
} as const;

const globalForScoreHandler = globalThis as unknown as {
  scoreHandler: ScoreHandler | undefined;
};

export class ScoreHandler {
  static get instance() {
    if (!globalForScoreHandler.scoreHandler) {
      globalForScoreHandler.scoreHandler = new ScoreHandler(db);
    }
    return globalForScoreHandler.scoreHandler;
  }

  private constructor(private readonly db: DB) {}

  public async currentScore(userId: string) {
    const totalScore = await this.db
      .select({
        score: sum(score.score),
      })
      .from(score)
      .where(eq(score.userId, userId));

    return Number(totalScore[0]?.score ?? 0);
  }

  public async updateScore(
    winnerId: string,
    looserId: string,
    fightId: string,
  ) {
    try {
      const currentLooserScore = await this.currentScore(looserId);
      const { looserSubtraction, winnerAddition } =
        this.calculateScoreEntries(currentLooserScore);
      await this.db.insert(score).values([
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

  public async getDashboard() {
    return await this.db
      .select({
        rank: sql<number>`RANK() OVER (ORDER BY SUM(${score.score}) DESC)`,
        score: sum(score.score),
        userId: score.userId,
      })
      .from(score)
      .groupBy(score.userId)
      .orderBy(desc(sum(score.score)));
  }

  public async getHistory(user: string) {
    return await this.db
      .select({
        fightId: fight.id,
        game: sql<KnownGames>`${fight.game}`,
        scoreChange: score.score,
        youWon: sql<boolean>`CASE WHEN ${fight.winner} = ${score.userId} THEN true ELSE false END`,
        score: sql<number>`SUM(${score.score}) OVER (PARTITION BY ${score.userId} ORDER BY ${fight.createdAt})`,
      })
      .from(fight)
      .innerJoin(score, eq(score.fightId, fight.id))
      .innerJoin(usersToFight, eq(fight.id, usersToFight.fightId))
      .where(eq(score.userId, user))
      .groupBy(fight.id, fight.game, fight.winner, score.score, score.userId)
      .orderBy(desc(fight.createdAt));
  }

  public async getHistoryEntry(userId: string, fightId: string) {
    const queryResult = await this.db
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
    const score = await this.db.query.score.findFirst({
      where: ({ fightId, userId }) => and(eq(fightId, fight), eq(userId, user)),
    });
    if (!score) {
      return { success: false } as const;
    }
    return { success: true, score: score.score };
  }

  private calculateScoreEntries(looserCurrentScore: number) {
    const reducePointsBy =
      (looserCurrentScore * staticScoringConfig.winnerGetsPercent) / 100;
    const winnerAddition = Math.max(
      staticScoringConfig.winnerMinimumPointsBonus,
      reducePointsBy,
    );

    const newLooserScore = looserCurrentScore - reducePointsBy;
    if (newLooserScore < staticScoringConfig.lowestScore) {
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
