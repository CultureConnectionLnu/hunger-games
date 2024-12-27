import { createStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { service } from "~/server/service";
import {
  type ConnectedViewRequirements,
  registerConnectionViewSubscribers,
} from "../core/connection-view-slice";
import { createRockPaperScissorsRequirement } from "../core/creator";
import { registerPlayerConnectionSubscribers } from "../core/player-connection-state-slice";
import { type SubscribeStore } from "../core/zustand-helper";
import { registerRockPaperScissorsSubscribers } from "./rock-paper-scissors-slice";
import {
  createRockPaperScissorsViewSlice,
  registerRockPaperScissorsViewSubscribers,
  type RockPaperScissorsViewRequirements,
} from "./rock-paper-scissors-view-slice";

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

type RockPaperScissorsGameStore = RockPaperScissorsViewRequirements &
  ConnectedViewRequirements;

function createRockPaperScissorsGame(player1Id: string, player2Id: string) {
  const store = createStore<RockPaperScissorsGameStore>()(
    subscribeWithSelector((...a) => ({
      ...createRockPaperScissorsViewSlice(player1Id, player2Id)(...a),
      ...createRockPaperScissorsRequirement(
        player1Id,
        player2Id,
        service.gameConfig.getRoomConfig(),
        service.gameConfig.getGameConfig("rockPaperScissors"),
      )(...a),
    })),
  );

  const subStore = store as SubscribeStore<RockPaperScissorsGameStore>;
  registerRockPaperScissorsSubscribers(subStore);
  registerRockPaperScissorsViewSubscribers(subStore);
  registerPlayerConnectionSubscribers(subStore);
  registerConnectionViewSubscribers(subStore);

  const { playerConnection, gameLogic } = store.getState();
  const { connectPlayer, disconnectPlayer, markReady } = playerConnection;
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { chooseItem } = gameLogic;

  return {
    store: subStore,
    roomInteractions: {
      connectPlayer,
      disconnectPlayer,
      markReady,
    },
    gameInteractions: {
      chooseItem,
    },
  };
}
