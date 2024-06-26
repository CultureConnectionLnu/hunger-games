import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "~/server/db";
import { fight, usersToFight } from "~/server/db/schema";
import { BaseGame } from "../core/base-game";
import { RpsGame } from "../games/rps";
import { clerkHandler, questHandler } from ".";
import { scoreHandler } from "./score";
import { getHandler } from "./base";
import { gameStateHandler } from "./game-state";
import { OMGame } from "../games/om";
import { TypingGame } from "../games/typing";

/**
 * insert a new entry for each game added
 */
const knownGames = {
  "rock-paper-scissors": RpsGame,
  "ordered-memory": OMGame,
  typing: TypingGame,
};
export type KnownGames = keyof typeof knownGames;

class LobbyHandler {
  private gameHandler = new GameHandler();

  public async assertHasNoFight(userId: string) {
    const existingFight = await this.getCurrentFight(userId);

    if (existingFight !== undefined) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "You already have an ongoing fight",
      });
    }
  }

  public async getCurrentFight(userId: string) {
    const existingFight = await db
      .select()
      .from(fight)
      .leftJoin(usersToFight, eq(fight.id, usersToFight.fightId))
      .where(and(isNull(fight.outcome), eq(usersToFight.userId, userId)))
      .execute();

    if (existingFight.length === 0) {
      return undefined;
    }

    return {
      fightId: existingFight[0]!.fight.id,
      game: existingFight[0]!.fight.game as KnownGames,
      players: existingFight.map((f) => f.usersToMatch?.userId).filter(Boolean),
    };
  }

  public async assertCurrentFight(userId: string) {
    const existingFight = await this.getCurrentFight(userId);
    if (!existingFight) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No ongoing fight",
      });
    }
    return existingFight;
  }

  public async getAllFightsOfPlayer(userId: string) {
    return await db
      .select({
        fightId: fight.id,
        game: sql<KnownGames>`${fight.game}`,
        youWon: sql<boolean>`CASE WHEN ${fight.winner} = ${userId} THEN true ELSE false END`,
        abandoned: sql<boolean>`CASE WHEN ${fight.outcome} = 'aborted' THEN true ELSE false END`,
      })
      .from(fight)
      .innerJoin(usersToFight, eq(fight.id, usersToFight.fightId))
      .where(eq(usersToFight.userId, userId))
      .orderBy(desc(fight.createdAt));
  }

  public async getOpponent(opponentId: string) {
    return db.query.users.findFirst({
      where: (users, { eq }) => eq(users.clerkId, opponentId),
    });
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

    const userName = await clerkHandler.getUserName(userId);
    const opponentName = await clerkHandler.getUserName(opponentId);

    const wrapper = this.gameHandler.createGame(gameType, {
      fightId: newFight.id,
      players: [
        { id: userId, name: userName },
        { id: opponentId, name: opponentName },
      ],
    });
    wrapper.gameDone = this.registerEndListener(wrapper.lobby);

    return wrapper;
  }

  public getFight(fightId: string) {
    return this.gameHandler.getGame(fightId);
  }

  public defineNextGameType(type: keyof typeof knownGames) {
    this.gameHandler.defineNextGameType(type);
  }

  private async registerEndListener(game: BaseGame) {
    try {
      const result = await new Promise<
        | {
            type: "ended";
            data: {
              winnerId: string;
              loserId: string;
            };
          }
        | {
            type: "aborted";
          }
        | {
            type: "destroyed";
          }
      >((resolve) => {
        game.once("game-ended", (event) => {
          resolve({ type: "ended", data: event.data });
        });
        game.once("game-aborted", () => resolve({ type: "aborted" }));
        game.once("destroy", () => {
          resolve({ type: "destroyed" });
        });
      });

      if (result.type === "destroyed") {
        // future logic that allows admins to destroy a fight, so this becomes intended behavior
        console.log(`Fight ${game.fightId} ended before it completed`);
        console.log(`Deleting fight`);
        await db.delete(fight).where(eq(fight.id, game.fightId));
      } else if (result.type === "aborted") {
        await db
          .update(fight)
          .set({ outcome: "aborted" })
          .where(eq(fight.id, game.fightId))
          .catch((error) => {
            throw new Error("Failed to update fight", { cause: error });
          });
        for (const playerId of game.playerTuple.map((x) => x.id)) {
          await questHandler.markQuestAsLost(playerId);
          await gameStateHandler.markPlayerAsWounded(playerId);
        }
      } else {
        const { winnerId, loserId } = result.data;
        await db
          .update(fight)
          .set({ outcome: "completed", winner: winnerId })
          .where(eq(fight.id, game.fightId))
          .catch((error) => {
            throw new Error("Failed to update fight", { cause: error });
          });
        await scoreHandler.updateScoreForFight(winnerId, loserId, game.fightId);
        await questHandler.markQuestAsLost(loserId);
        await gameStateHandler.markPlayerAsWounded(loserId);
      }
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

type GetSpecificGame<T extends KnownGames, Map> = Map extends { type: T }
  ? Map
  : never;

export type RockPaperScissorsGameInstance = GetSpecificGame<
  "rock-paper-scissors",
  KnownGamesMap
>;
export type OrderedMemoryGameInstance = GetSpecificGame<
  "ordered-memory",
  KnownGamesMap
>;
export type TypingGameInstance = GetSpecificGame<"typing", KnownGamesMap>;

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
  ) {
    const game = new knownGames[type](props.fightId, props.players);
    const lobby = new BaseGame(props.fightId, props.players, game);

    const setup = {
      type,
      lobby,
      game,
    } as GetSpecificGame<T, KnownGamesMap>;
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

declare global {
  interface HungerGamesHandlers {
    lobby?: LobbyHandler;
  }
}

export const lobbyHandler = getHandler("lobby", () => new LobbyHandler());
