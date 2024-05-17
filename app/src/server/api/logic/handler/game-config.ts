import { db } from "~/server/db";
import { getHandler } from "./base";
import { gameConfig } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

const defaultConfig = {
  enableGame: false,
};

export const configNameSchema = z.enum(["enableGame"]);

class GameConfigHandler {
  public async ensureConfigsExist() {
    const existingConfigs = await this.getConfig();
    const existingKeys = Object.keys(existingConfigs);
    const keysItShouldHave = Object.keys(defaultConfig);
    const keysToAdd = keysItShouldHave.filter(
      (key) => !existingKeys.includes(key),
    );

    if (keysToAdd.length === 0) {
      return false;
    }

    await db.insert(gameConfig).values(
      (keysToAdd as (keyof typeof defaultConfig)[]).map((key) => ({
        name: key,
        enabled: defaultConfig[key],
      })),
    );

    return true;
  }

  public async getConfig() {
    const allSettings = await db.query.gameConfig.findMany();
    return allSettings.reduce<Record<string, boolean>>((acc, setting) => {
      acc[setting.name] = setting.enabled;
      return acc;
    }, {}) as typeof defaultConfig;
  }

  public async assertGameEnabled() {
    const config = await this.getConfig();
    if (config.enableGame === false) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "The game is disabled",
      });
    }
  }

  public async setConfig(key: keyof typeof defaultConfig, value: boolean) {
    await db
      .update(gameConfig)
      .set({ enabled: value })
      .where(eq(gameConfig.name, key));
  }
}

declare global {
  interface HungerGamesHandlers {
    gameConfig?: GameConfigHandler;
  }
}

export const gameConfigHandler = getHandler(
  "gameConfig",
  () => new GameConfigHandler(),
);
