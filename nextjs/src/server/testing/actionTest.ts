import { inArray } from "drizzle-orm";
import { db } from "../db";
import { match } from "../db/schema";
import { service } from "../service";
import { type GameEntry } from "../service/active-games-service";
import { waitUntil } from "./utils";

type TestState = {
  createdGames: GameEntry[];
  completedGames: GameEntry[];
};

export function actionTest(testFn: () => Promise<void>) {
  const state: TestState = {
    createdGames: [],
    completedGames: [],
  };

  // listener functions
  const createGameListener = (game: GameEntry) => {
    state.createdGames.push(game);
  };
  const completeGameListener = (game: GameEntry) => {
    state.completedGames.push(game);
  };

  return async () => {
    // add listeners
    service.activeGames.on("gameCreated", createGameListener);
    service.activeGames.on("gameCompleted", completeGameListener);

    try {
      await testFn();
    } finally {
      // remove listeners
      service.activeGames.off("gameCreated", createGameListener);

      // cleanup data
      await forceStopAllGames(state);

      service.activeGames.off("gameCompleted", completeGameListener);
      await removeAllMatches(state.createdGames.map((game) => game.id));
    }
  };
}

async function forceStopAllGames(state: TestState) {
  state.createdGames.forEach((game) => {
    game.game.store.getState().gameResult.forceStopGame();
  });
  await waitUntil(
    () => state.createdGames.length === state.completedGames.length,
    () =>
      `Games did not stop in time. Created: ${state.createdGames.length}, Completed: ${state.completedGames.length}`,
  );
}

async function removeAllMatches(ids: number[]) {
  await db.delete(match).where(inArray(match.id, ids));
}
