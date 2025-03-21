import { inArray } from "drizzle-orm";
import { db } from "../db";
import { match } from "../db/schema";
import { service } from "../service";
import { type GameEntry } from "../service/active-games-service";

export function actionTest(testFn: () => Promise<void>) {
  const state: {
    createdGames: GameEntry[];
  } = {
    createdGames: [],
  };

  // listener functions
  const createGameListener = (game: GameEntry) => {
    state.createdGames.push(game);
  };

  return async () => {
    // add listeners
    service.activeGames.on("gameCreated", createGameListener);

    try {
      await testFn();
    } finally {
      // remove listeners
      service.activeGames.off("gameCreated", createGameListener);

      // cleanup data
      await removeAllMatches(state.createdGames.map((game) => game.id));
      state.createdGames.forEach((game) => {
        game.game.store.getState().gameResult.forceStopGame();
      });
    }
  };
}

async function removeAllMatches(ids: number[]) {
  await db.delete(match).where(inArray(match.id, ids));
}
