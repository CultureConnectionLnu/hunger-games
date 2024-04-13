import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { db, type DB } from "~/server/db";
import { fight, usersToFight } from "~/server/db/schema";
import { BaseGame } from "./core/base-game";
import { RpsGame } from "./games/rps";
import { ScoreHandler } from "./score";
import { UserHandler } from "./user";

// todo: remove force delete from here or only have it here

/**
 * insert a new entry for each game added
 */
const knownGames = {
  "rock-paper-scissors": RpsGame,
};

const globalForFightHandler = globalThis as unknown as {
  fightHandler: FightHandler | undefined;
};

export class FightHandler {
  static get instance() {
    if (!globalForFightHandler.fightHandler) {
      globalForFightHandler.fightHandler = new FightHandler(db);
    }
    return globalForFightHandler.fightHandler;
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

    const userName = await UserHandler.instance.getUserName(userId);
    const opponentName = await UserHandler.instance.getUserName(opponentId);

    const wrapper = this.gameHandler.createGame(gameType, {
      fightId: newFight.id,
      players: [
        { id: userId, name: userName },
        { id: opponentId, name: opponentName },
      ],
    });
    wrapper.gameDone = this.registerEndListener(wrapper.lobby);

    return newFight;
  }

  public getFight(fightId: string) {
    return this.gameHandler.getGame(fightId);
  }

  public defineNextGameType(type: keyof typeof knownGames) {
    this.gameHandler.defineNextGameType(type);
  }

  private async registerEndListener(game: BaseGame) {
    try {
      const winner = await new Promise<string>((resolve, reject) => {
        game.once("game-ended", (event) => {
          resolve(event.data.winnerId);
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

      const looser = game.playerTuple.find(({ id }) => id !== winner)!;
      await ScoreHandler.instance.updateScore(winner, looser.id, game.fightId);
    } catch (error) {
      console.log("Game completed with an error", error);
    }
    // make sure that it is actually cleaned up
    game.destroy();
  }
}

type KnownGamesMap = {
  [K in keyof typeof knownGames]: {
    type: K;
    lobby: BaseGame;
    game: InstanceType<(typeof knownGames)[K]>;
    gameDone?: Promise<void>;
  };
}[keyof typeof knownGames];

class GameHandler {
  private readonly runningGames = new Map<string, KnownGamesMap>();
  private nextGameType?: keyof typeof knownGames;

  public getGame(fightId: string) {
    return this.runningGames.get(fightId);
  }

  public getRandomGameType() {
    if (this.nextGameType) {
      const gameType = this.nextGameType;
      this.nextGameType = undefined;
      return gameType;
    }

    const allOptions = Object.keys(knownGames) as (keyof typeof knownGames)[];
    const randomIndex = Math.floor(Math.random() * allOptions.length);
    return allOptions[randomIndex]!;
  }

  public createGame<T extends keyof typeof knownGames>(
    type: T,
    props: { fightId: string; players: { id: string; name: string }[] },
  ): KnownGamesMap {
    const game = new knownGames[type](props.fightId, props.players);
    const lobby = new BaseGame(props.fightId, props.players, game);

    const setup = {
      type,
      lobby,
      game,
    };
    this.runningGames.set(props.fightId, setup);

    lobby.once("destroy", () => {
      this.runningGames.delete(props.fightId);
    });

    return setup;
  }

  defineNextGameType(type: keyof typeof knownGames) {
    this.nextGameType = type;
  }
}
