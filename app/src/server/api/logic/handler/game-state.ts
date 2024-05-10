import { type DB, db } from "~/server/db";
import { getHandler } from "./base";
import { gamePlayerState } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { playerStateConfig } from "../config";

class GameStateHandler {
  public async createPlayerState(playerId: string, db: DB) {
    return db.insert(gamePlayerState).values({
      userId: playerId,
    });
  }

  public async deletePlayerState(playerId: string, db: DB) {
    return db
      .delete(gamePlayerState)
      .where(eq(gamePlayerState.userId, playerId));
  }

  public async getPlayerState(playerId: string) {
    return db.query.gamePlayerState.findFirst({
      where: ({ userId }, { eq }) => eq(userId, playerId),
    });
  }

  public async getAllWoundedPlayers() {
    return db.query.gamePlayerState.findMany({
      where: ({ isWounded }, { eq }) => eq(isWounded, true),
    });
  }

  public async markPlayerAsWounded(playerId: string) {
    const changed = await db
      .update(gamePlayerState)
      .set({ isWounded: true })
      .where(eq(gamePlayerState.userId, playerId));
    if (changed.count === 0) {
      return { success: false, error: "No player state found" } as const;
    }
    return { success: true } as const;
  }

  public async startRevivingPlayer(playerId: string) {
    const playerState = await this.getPlayerState(playerId);
    if (!playerState) {
      return { success: false, error: "No player state found" } as const;
    }

    if (!playerState.isWounded) {
      return { success: false, error: "Player is not wounded" } as const;
    }
    // todo: show a timer to the player
    // todo: show all counters to the medic managers
    const reviveCoolDownEnd = new Date(
      Date.now() + playerStateConfig.reviveTimeInSeconds * 1000,
    );
    const changed = await db
      .update(gamePlayerState)
      .set({
        reviveCoolDownEnd,
      })
      .where(eq(gamePlayerState.userId, playerId));
    if (changed.count === 0) {
      return { success: false, error: "No player state found" } as const;
    }
    return {
      success: true,
      reviveCoolDownEnd,
    } as const;
  }

  public async finishRevivingPlayer(playerId: string) {
    const playerState = await this.getPlayerState(playerId);
    if (!playerState) {
      return { success: false, error: "No player state found" } as const;
    }

    if (!playerState.isWounded) {
      return { success: false, error: "Player is not wounded" } as const;
    }
    if (!playerState.reviveCoolDownEnd) {
      return {
        success: false,
        error: "Player did not start revive yet",
      } as const;
    }

    const currentTime = new Date();
    if (currentTime < playerState.reviveCoolDownEnd) {
      return {
        success: false,
        error: "Player is still reviving",
      } as const;
    }

    const changed = await db
      .update(gamePlayerState)
      .set({
        isWounded: false,
        reviveCoolDownEnd: null,
      })
      .where(eq(gamePlayerState.userId, playerId));

    if (changed.count === 0) {
      return { success: false, error: "No player state found" } as const;
    }

    return { success: true } as const;
  }
}

declare global {
  interface HungerGamesHandlers {
    gameState?: GameStateHandler;
  }
}

export const gameStateHandler = getHandler(
  "gameState",
  () => new GameStateHandler(),
);
