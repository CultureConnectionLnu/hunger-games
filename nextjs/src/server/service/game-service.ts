import { type GameResult } from "../stores/core/game-result-slice";
import { createGameFactory, type GameMap } from "../stores/games/game-factory";
import { registerService, type Service } from "./types";

// #region types

declare global {
  interface KnownServiceMap {
    game: GameService;
  }
}

export type GameList = {
  [K in keyof GameMap]: { type: K; store: GameMap[K]; playerIds: string[] };
}[keyof GameMap];

// #endregion

class GameService implements Service {
  private games: GameList[] = [];

  getGameOfPlayer(playerId: string) {
    return this.games.find((game) => game.playerIds.includes(playerId));
  }

  createNewGame(
    players: [string, string],
    onGameComplete: (outcome: GameResult) => Promise<void>,
  ) {
    const [player1Id, player2Id] = players;

    const game = createGameFactory("rock-paper-scissors", player1Id, player2Id);
    this.games.push({
      type: "rock-paper-scissors",
      store: game,
      playerIds: [player1Id, player2Id],
    });

    const unSub = game.subscribe(
      (state) => state.gameResult.outcome,
      (outcome) => {
        if (outcome.result === "ongoing") return;

        void onGameComplete(outcome).finally(() => {
          // get rid of the reference
          unSub();
          this.games = this.games.filter((wrapper) => wrapper.store !== game);
        });
      },
    );
  }

  cleanup() {
    this.games.forEach((game) => {
      game.store.getState().gameResult.forceStopGame();
    });
    this.games = [];
  }
}

// make sure the service is instantiated
registerService(GameService, "game");
