import { env } from "~/env";
import type { BaseGameConfig } from "./core/base-game";
import type { RockPaperScissorsConfig } from "./games/rps";
import { type QuestKind } from "./handler";
import { type OrderedMemoryConfig } from "./games/om";

const longAssTime = 1_000_000;

export const generalGameConfig: BaseGameConfig = {
  get startTimeoutInSeconds() {
    return env.FEATURE_GAME_TIMEOUT ? 30 : longAssTime;
  },
  get disconnectTimeoutInSeconds() {
    return env.FEATURE_GAME_TIMEOUT ? 60 : longAssTime;
  },
  get forceStopInSeconds() {
    return env.FEATURE_GAME_TIMEOUT ? 60 * 60 : longAssTime;
  },
};

export const fightScoringConfig = {
  lowestScore: 0,
  winnerGetsPercent: 50,
  winnerMinimumPointsBonus: 100,
} as const;

export const questScoringConfig = {
  "walk-1": 100,
  "walk-2": 300,
  "walk-3": 900,
} satisfies Record<QuestKind, number>;

export const playerStateConfig = {
  reviveTimeInSeconds: 120,
};

export const rockPaperScissorsConfig: RockPaperScissorsConfig = {
  get chooseTimeoutInSeconds() {
    return env.FEATURE_GAME_TIMEOUT ? 5 : longAssTime;
  },
  get nextRoundTimeoutInSeconds() {
    // should not be affected by the feature flag
    return 5;
  },
  bestOf: 3,
  evaluation: [
    {
      item: "rock",
      beats: ["scissors"],
    },
    {
      item: "scissors",
      beats: ["paper"],
    },
    {
      item: "paper",
      beats: ["rock"],
    },
  ],
};

export const orderedMemoryConfig: OrderedMemoryConfig = {
  showPatternTimeoutInSeconds: 2,
  inputPatternTimeoutInSeconds: 10,
  nextRoundTimeoutInSeconds: 5,
};
