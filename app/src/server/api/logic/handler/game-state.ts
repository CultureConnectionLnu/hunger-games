import { type DB, db } from "~/server/db";
import { getHandler } from "./base";
import { gamePlayerState } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { playerStateConfig } from "../config";
import { TRPCError } from "@trpc/server";

import { Temporal, toTemporalInstant } from "@js-temporal/polyfill";
Date.prototype.toTemporalInstant = toTemporalInstant;

declare global {
  interface Date {
    toTemporalInstant: typeof toTemporalInstant;
  }
}

class GameStateHandler {
  private fakeTimePassed = false;

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
    return db.query.gamePlayerState
      .findMany({
        where: ({ isWounded }, { eq }) => eq(isWounded, true),
      })
      .then((allWoundedPlayers) =>
        allWoundedPlayers
          .map((player) => parsePlayerState(player))
          .filter(Boolean),
      );
  }

  public async getWoundedPlayer(playerId: string) {
    const rawState = await getSpecificPlayerState(playerId);
    return parsePlayerState(rawState);
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

    if (playerState.reviveCoolDownEnd !== null) {
      return {
        success: false,
        error: "Player revive already started",
      } as const;
    }
    // todo: show a timer to the player
    // todo: show all counters to the medic managers

    const reviveCoolDownEnd = Temporal.Now.plainDateTimeISO()
      .add({
        seconds: playerStateConfig.reviveTimeInSeconds,
      })
      .toLocaleString();

    const changed = await db
      .update(gamePlayerState)
      .set({
        reviveCoolDownEnd: new Date(reviveCoolDownEnd),
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
    if (!this.fakeTimePassed && currentTime < playerState.reviveCoolDownEnd) {
      return {
        success: false,
        error: "Player is still reviving",
      } as const;
    }
    this.fakeTimePassed = false;

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

  public async isPlayerWounded(playerId: string) {
    const gameState = await this.getPlayerState(playerId);
    if (!gameState) {
      const error = new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Player ${playerId} has no game state, even though he should`,
      });
      console.log("[Lobby:Create] impossible behavior met", error);
      throw error;
    }
    return gameState.isWounded;
  }

  public async assertPlayerNotWounded(
    playerId: string,
    messageIfWounded: string,
  ) {
    if (await this.isPlayerWounded(playerId)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: messageIfWounded,
      });
    }
  }
  public fakeTimePass() {
    this.fakeTimePassed = true;
  }
}

function getSpecificPlayerState(playerId: string) {
  return db.query.gamePlayerState.findFirst({
    where: ({ isWounded, userId }, { and, eq }) =>
      and(eq(isWounded, true), eq(userId, playerId)),
  });
}

function parsePlayerState(
  player: Awaited<ReturnType<typeof getSpecificPlayerState>>,
) {
  if (!player) return undefined;

  const initialTimeoutInSeconds = calculateDiffInSeconds(
    player.reviveCoolDownEnd,
  );
  return {
    userId: player.userId,
    isWounded: player.isWounded,
    initialTimeoutInSeconds,
    reviveCoolDownEnd: player.reviveCoolDownEnd ?? undefined,
  };
}

function calculateDiffInSeconds(date: Date | null | undefined) {
  if (!date) return undefined;
  const now = Temporal.Now.plainTimeISO();
  const end = Temporal.PlainTime.from({
    second: date.getSeconds(),
    minute: date.getMinutes(),
    hour: date.getHours(),
  });
  if (Temporal.PlainTime.compare(now, end) === 1) {
    return 0;
  }
  const difference = end.subtract({
    seconds: now.second,
    minutes: now.minute,
    hours: now.hour,
  });
  return difference.second + difference.minute * 60 + difference.hour * 60 * 60;
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
