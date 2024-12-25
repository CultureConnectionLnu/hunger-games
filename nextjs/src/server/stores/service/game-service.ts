import { type GameResult } from "../core/game-result-slice";
import { createGameFactory, type GameMap } from "../games/game-factory";
import { type Service as Service } from "./types";

declare global {
  interface KnownServiceMap {
    gameService: GameService;
  }
}

export type GameList = {
  [K in keyof GameMap]: { type: K; store: GameMap[K]; playerIds: string[] };
}[keyof GameMap];

class GameService implements Service {
  name = "gameService" as const;
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
      // todo: function that force destroys a game
    });
  }
}
