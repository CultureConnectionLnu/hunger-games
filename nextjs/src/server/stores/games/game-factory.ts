import { Temporal } from "temporal-polyfill";
import {
  createRockPaperScissorsRequirement,
  type RockPaperScissorsConfig,
  type RoomConfig,
} from "../core/creator";
import { createStore } from "zustand";
import {
  createRockPaperScissorsViewSlice,
  registerRockPaperScissorsViewSubscribers,
  type RockPaperScissorsViewRequirements,
} from "./rock-paper-scissors-view-slice";
import { subscribeWithSelector } from "zustand/middleware";
import { type SubscribeStore } from "../core/zustand-helper";
import { registerRockPaperScissorsSubscribers } from "./rock-paper-scissors-slice";
import { registerPlayerConnectionSubscribers } from "../core/player-connection-state-slice";

export type GameMap = {
  "rock-paper-scissors": ReturnType<typeof createRockPaperScissorsGame>;
};
export type GameType = keyof GameMap;

export function createGameFactory(
  type: GameType,
  player1Id: string,
  player2Id: string,
) {
  return createRockPaperScissorsGame(player1Id, player2Id);
}

const roomConfig: RoomConfig = {
  forceStop: Temporal.Duration.from({ seconds: 120 }),
  disconnectLoose: Temporal.Duration.from({ seconds: 10 }),
  startTimeout: Temporal.Duration.from({ seconds: 30 }),
};

const gamesConfig = {
  rockPaperScissors: {
    roundsLimit: 10,
    roundsNeededToWin: 3,
    durations: {
      chooseTimeout: Temporal.Duration.from({ seconds: 5 }),
      roundResult: Temporal.Duration.from({ seconds: 7 }),
    },
  } satisfies RockPaperScissorsConfig,
};

function createRockPaperScissorsGame(player1Id: string, player2Id: string) {
  const store = createStore<RockPaperScissorsViewRequirements>()(
    subscribeWithSelector((...a) => ({
      ...createRockPaperScissorsViewSlice(player1Id, player2Id)(...a),
      ...createRockPaperScissorsRequirement(
        player1Id,
        player2Id,
        roomConfig,
        gamesConfig.rockPaperScissors,
      )(...a),
    })),
  );

  const subStore = store as SubscribeStore<RockPaperScissorsViewRequirements>;
  registerRockPaperScissorsSubscribers(subStore);
  registerRockPaperScissorsViewSubscribers(subStore);
  registerPlayerConnectionSubscribers(subStore);

  return subStore;
}
