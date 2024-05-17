import { env } from "~/env";
import type { BaseGameConfig } from "./core/base-game";
import { type OrderedMemoryConfig } from "./games/om";
import type { RockPaperScissorsConfig } from "./games/rps";
import { type TypingConfig } from "./games/typing";
import { type WalkQuestKind } from "./handler";

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
  "walk-3": 600,
} satisfies Record<WalkQuestKind, number>;

export const playerStateConfig = {
  reviveTimeInSeconds: env.NEXT_PUBLIC_NODE_ENV === "development" ? 10 : 120,
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

export const typingConfig: TypingConfig = {
  writingTimeInSeconds: 45,
  timePenaltyPerMistakeInSeconds: 1,
  nextRoundTimeInSeconds: 5,
};
