import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, type DB } from "~/server/db";
import { fight, usersToFight } from "~/server/db/schema";
import { RockPaperScissorsMatch } from "./rock-paper-scissors";
import { BaseGame } from "./base-game";

/**
 * insert a new entry for each game added 
 */
const knownGames = {
  "rock-paper-scissors": RockPaperScissorsMatch,
} satisfies Record<string, new (fightId: string, players: string[]) => AnyGame>;

export class FightHandler {
  private static _instance: FightHandler;
  static get instance() {
    if (!this._instance) {
      this._instance = new FightHandler(db);
    }
    return this._instance;
  }

  private gameHandler = new GameHandler();

  constructor(private readonly db: DB) {}

  public async assertHasNoFight(userId: string) {
    const existingFight = await this.db
      .select()
      .from(fight)
      .leftJoin(usersToFight, eq(fight.id, usersToFight.fightId))
      .where(and(isNull(fight.winner), eq(usersToFight.userId, userId)))
      .limit(1)
      .execute();

    if (existingFight.length > 0) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You already have an ongoing fight",
      });
    }
  }

  public async getCurrentFight(userId: string) {
    const existingFight = await this.db
      .select()
      .from(fight)
      .leftJoin(usersToFight, eq(fight.id, usersToFight.fightId))
      .where(and(isNull(fight.winner), eq(usersToFight.userId, userId)))
      .execute();

    if (existingFight.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No ongoing fight",
      });
    }

    return {
      fightId: existingFight[0]!.fight.id,
      game: existingFight[0]!.fight.game,
      players: existingFight.map((f) => f.usersToMatch?.userId).filter(Boolean),
    };
  }

  public async createFight(userId: string, opponentId: string) {
    const gameType = this.gameHandler.getRandomGameType();

    const newFight = await db.transaction(async (tx) => {
      const newFights = await tx
        .insert(fight)
        .values({ game: gameType })
        .returning({ id: fight.id, game: fight.game });
      const newFight = newFights[0];

      if (!newFight) {
        tx.rollback();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create fight",
        });
      }
      await tx.insert(usersToFight).values(
        [opponentId, userId].map((userId) => ({
          fightId: newFight.id,
          userId,
        })),
      );

      return newFight;
    });

    const game = this.gameHandler.createGame(gameType, {
      fightId: newFight.id,
      players: [userId, opponentId],
    });
    void this.registerEndListener(game);

    return newFight;
  }

  public getGame(fightId: string) {
    return this.gameHandler.getGame(fightId);
  }

  private async registerEndListener(game: AnyGame) {
    try {
      const winner = await new Promise<string>((resolve, reject) => {
        game.once("end", (event) => {
          resolve(event.winner);
        });
        game.once("destroy", () => {
          reject(new Error("Game destroyed before it ended"));
        });
      });
      await this.db
        .update(fight)
        .set({ winner })
        .where(eq(fight.id, game.fightId))
        .catch((error) => {
          throw new Error("Failed to update fight", { cause: error });
        });
    } catch (error) {
      console.log("Game completed with an error", error);
    }
    // make sure that it is actually cleaned up
    game.destroy();
  }
}
// eslint-disable-next-line @typescript-eslint/ban-types
type AnyGame = BaseGame<{}>;

type KnownGamesMap = {
  [K in keyof typeof knownGames]: {
    type: K;
    instance: InstanceType<(typeof knownGames)[K]>;
  };
}[keyof typeof knownGames];


class GameHandler {
  private readonly runningGames = new Map<string, KnownGamesMap>();
  private readonly forceDeleteGameTimeout = 1000 * 60 * 60;

  public getGame(fightId: string) {
    return this.runningGames.get(fightId);
  }

  public getRandomGameType() {
    const allOptions = Object.keys(knownGames) as (keyof typeof knownGames)[];
    const randomIndex = Math.floor(Math.random() * allOptions.length);
    return allOptions[randomIndex]!;
  }

  public createGame<T extends keyof typeof knownGames>(
    type: T,
    props: { fightId: string; players: string[] },
  ) {
    const game = new knownGames[type](props.fightId, props.players);

    this.runningGames.set(props.fightId, { type, instance: game });
    this.registerCleanup(game);

    return game;
  }

  private registerCleanup(game: AnyGame) {
    // make sure the game is automatically removed after a certain time
    const timeout = setTimeout(
      () => game.destroy(),
      this.forceDeleteGameTimeout,
    );
    game.once("end", () => {
      clearTimeout(timeout);
      game.destroy();
    });
    game.once("destroy", () => {
      clearTimeout(timeout);
      this.runningGames.delete(game.fightId);
    });
  }
}
