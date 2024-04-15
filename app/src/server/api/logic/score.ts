import { and, desc, eq, sum } from "drizzle-orm";
import { type DB, db } from "~/server/db";
import { score } from "~/server/db/schema";
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
        fight: {
          with: {
            participants: true,
          },
        },
      },
      where: ({ userId }) => eq(userId, user),
      orderBy: ({ createdAt }) => desc(createdAt),
    });
    const failedFightIds: string[] = [];
    const history = rawHistory.map((x) => {
      if (x.fight === null) {
        failedFightIds.push(x.fightId);
        return {
          fightId: x.fightId,
          game: "???" as const,
          opponentId: undefined,
          youWon: false,
          score: x.score,
        };
      }
      return {
        fightId: x.fightId,
        game: x.fight.game as KnownGames,
        opponentId: x.fight.participants.find((y) => y.userId !== user)?.userId,
        youWon: x.fight.winner === user,
        score: x.score,
      };
    });
    return { history, failedFightIds };
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
