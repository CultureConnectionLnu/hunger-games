import { Temporal } from "temporal-polyfill";
import { registerService, type Service } from "./types";
import {
  type RockPaperScissorsConfig,
  type RoomConfig,
} from "../stores/core/creator";
import { type DeepPartial } from "../stores/core/zustand-helper";

declare global {
  interface KnownServiceMap {
    gameConfig: GameConfigService;
  }
}

const defaultRoomConfig: RoomConfig = {
  forceStop: Temporal.Duration.from({ seconds: 120 }),
  disconnectLoose: Temporal.Duration.from({ seconds: 10 }),
  startTimeout: Temporal.Duration.from({ seconds: 30 }),
};

const defaultGamesConfig = {
  rockPaperScissors: {
    roundsLimit: 10,
    roundsNeededToWin: 3,
    durations: {
      chooseTimeout: Temporal.Duration.from({ seconds: 5 }),
      roundResult: Temporal.Duration.from({ seconds: 7 }),
    },
  } satisfies RockPaperScissorsConfig,
};

class GameConfigService implements Service {
  private roomConfig = { ...defaultRoomConfig };
  private gamesConfig = { ...defaultGamesConfig };

  cleanup() {
    // nothing to cleanup
  }

  getRoomConfig() {
    return this.roomConfig;
  }

  getGameConfig(gameType: keyof typeof defaultGamesConfig) {
    return this.gamesConfig[gameType];
  }

  setRoomConfig(config: Partial<RoomConfig>) {
    this.roomConfig = { ...this.roomConfig, ...config };
  }

  setGameConfig(
    gameType: keyof typeof defaultGamesConfig,
    config: DeepPartial<RockPaperScissorsConfig>,
  ) {
    this.gamesConfig = {
      rockPaperScissors:
        gameType !== "rockPaperScissors"
          ? this.gamesConfig.rockPaperScissors
          : {
              ...this.gamesConfig.rockPaperScissors,
              ...config,
              durations:
                config.durations === undefined
                  ? this.gamesConfig.rockPaperScissors.durations
                  : {
                      ...this.gamesConfig.rockPaperScissors.durations,
                      ...config.durations,
                    },
            },
    };
  }
}

registerService(GameConfigService, "gameConfig");
