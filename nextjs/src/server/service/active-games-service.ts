import { EventEmitter } from "events";
import { type GameResult } from "../stores/core/game-result-slice";
import { createGameFactory, type GameMap } from "../stores/games/game-factory";
import { registerService, type TypedEventEmitter, type Service } from "./types";

// #region types

declare global {
  interface KnownServiceMap {
    activeGames: ActiveGameService;
  }
}

export type GameEntry = {
  [K in keyof GameMap]: {
    type: K;
    game: GameMap[K];
    playerIds: string[];
    id: number;
  };
}[keyof GameMap];

// #endregion

class ActiveGameService
  extends EventEmitter
  implements
    Service,
    TypedEventEmitter<{
      gameCreated: GameEntry;
      gameCompleted: GameEntry;
    }>
{
  private games: GameEntry[] = [];
  private playerJoinListeners = new Map<string, (game: GameEntry) => void>();

  getAllActiveGames() {
    return [...this.games];
  }

  getActiveGameOfPlayer(playerId: string) {
    return this.games.find((game) => game.playerIds.includes(playerId));
  }

  async createNewGame(
    gameId: number,
    gameType: keyof GameMap,
    players: [string, string],
    onGameComplete: (outcome: GameResult) => Promise<void>,
  ) {
    const [player1Id, player2Id] = players;

    const game = createGameFactory(gameType, player1Id, player2Id);
    const gameEntry = {
      type: gameType,
      game,
      playerIds: players,
      id: gameId,
    } satisfies GameEntry;
    this.games.push(gameEntry);
    this.playerJoinListeners.get(player1Id)?.(gameEntry);
    this.playerJoinListeners.get(player2Id)?.(gameEntry);

    const unSub = game.store.subscribe(
      (state) => state.gameResult.outcome,
      (outcome) => {
        if (outcome.result === "ongoing") return;

        void onGameComplete(outcome).finally(() => {
          // get rid of the reference
          unSub();
          this.games = this.games.filter((wrapper) => wrapper.game !== game);
          this.emit("gameCompleted", gameEntry);
        });
      },
    );

    this.emit("gameCreated", gameEntry);
  }

  listenForPlayerJoiningGame(
    playerId: string,
    cb: (gameEntry: GameEntry) => void,
  ) {
    this.playerJoinListeners.set(playerId, cb);
    return () => {
      this.playerJoinListeners.delete(playerId);
    };
  }

  cleanup() {
    this.games.forEach((gameEntry) => {
      gameEntry.game.store.getState().gameResult.forceStopGame();
    });
    this.games = [];
    this.removeAllListeners();
  }
}

// make sure the service is instantiated
registerService(ActiveGameService, "activeGames");
