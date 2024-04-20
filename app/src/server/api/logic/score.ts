import { and, desc, eq, not, sum } from "drizzle-orm";
import { type DB, db } from "~/server/db";
import { fight, score, usersToFight } from "~/server/db/schema";
import { type KnownGames } from "./fight";
import { UserHandler } from "./user";

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
    const queryResult = await this.db
      .select({
        score: sum(score.score),
        userId: score.userId,
      })
      .from(score)
      .groupBy(score.userId);

    const scoreMap = queryResult
      // make sure it is the correct type
      .map((x) => ({
        score: Number(x.score ?? 0),
        userId: x.userId,
      }))
      // order in descending order
      .sort((a, b) => b.score - a.score)
      // group by score
      .reduce<Map<number, string[]>>((map, score) => {
        const players = map.get(score.score) ?? [];
        players.push(score.userId);
        map.set(score.score, players);
        return map;
      }, new Map());

    /**
     * The rank is the position in the array + 1.
     * If multiple players have the same rank, the rank is the same for all of them.
     * The next player has the rank of the last player + the number of players with the same rank.
     */
    const rankedScores: { userId: string; score: number; rank: number }[] = [];
    let rank = 1;
    for (const [score, userIds] of scoreMap) {
      for (const userId of userIds) {
        rankedScores.push({ userId, score, rank });
      }
      rank += userIds.length;
    }

    return rankedScores;
  }

  public async getHistory(user: string) {
    const rawHistory = await this.db.query.score.findMany({
      with: {
        fight: true,
      },
      where: ({ userId }) => eq(userId, user),
      orderBy: ({ createdAt }) => desc(createdAt),
    });

    const failedFightIds: string[] = [];
    let score = 0;

    const history = rawHistory.map((x) => {
      const scoreChange =
        x.fight === null ? 0 : x.fight.winner === user ? x.score : -x.score;
      score += scoreChange;

      if (x.fight === null) {
        failedFightIds.push(x.fightId);
        return {
          fightId: x.fightId,
          game: "???" as const,
          youWon: false,
          scoreChange,
          score,
        };
      }

      return {
        fightId: x.fightId,
        game: x.fight.game as KnownGames,
        youWon: x.fight.winner === user,
        scoreChange,
        score,
      };
    });
    return { history, failedFightIds };
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
