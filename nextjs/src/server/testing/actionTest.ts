import { inArray } from "drizzle-orm";
import { db } from "../db";
import { match } from "../db/schema";
import { service } from "../service";
import { type GameEntry } from "../service/active-games-service";
import { waitUntil } from "./utils";
import { clerkTesting } from "../auth/clerk";
import { startGame } from "../api/game";

type TestState = {
  createdGames: GameEntry[];
  completedGames: GameEntry[];
};

type TestHelpers = {
  startGame(
    opponent: keyof typeof clerkTesting.testUserMap,
  ): Promise<GameHelper>;
};

export function actionTest(testFn: (helpers: TestHelpers) => Promise<void>) {
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
      await testFn({
        startGame: async (opponent) => {
          const opponentId = clerkTesting.testUserMap[opponent];
          const matchId = (await startGame({ opponentId }))._unsafeUnwrap();
          const activeGame = service.activeGames
            .getAllActiveGames()
            .find((game) => game.id === matchId);
          if (!activeGame) {
            throw new Error("Game not found");
          }
          return new GameHelper(opponentId, activeGame);
        },
      });
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

class GameHelper {
  private matchId;
  private store;
  private getId;
  private getOpponentId;

  constructor(
    private opponentId: string,
    private activeGame: GameEntry,
  ) {
    this.matchId = activeGame.id;
    this.store = activeGame.game.store.getState();

    this.getId = (player: "initiator" | "opponent") => {
      if (player === "initiator") {
        return this.store.connectedView.mutable.player1.id;
      }
      return this.store.connectedView.mutable.player2.id;
    };
    this.getOpponentId = (player: "initiator" | "opponent") =>
      this.getId(player === "initiator" ? "opponent" : "initiator");
  }

  public async fakeWin(winner: "initiator" | "opponent") {
    return new Promise<this>((resolve) => {
      service.activeGames.once("gameCompleted", () => {
        resolve(this);
      });
      this.store.gameResult.gameWon(
        this.getId(winner),
        this.getOpponentId(winner),
      );
    });
  }

  public async fakeTie() {
    return new Promise<this>((resolve) => {
      service.activeGames.once("gameCompleted", () => {
        resolve(this);
      });
      this.store.gameResult.gameTied();
    });
  }

  public async fakePlayerDisconnected(winner: "initiator" | "opponent") {
    return new Promise<this>((resolve) => {
      service.activeGames.once("gameCompleted", () => {
        resolve(this);
      });
      this.store.gameResult.otherPlayerDisconnected(
        this.getId(winner),
        this.getOpponentId(winner),
      );
    });
  }

  public async fakeForceStop() {
    return new Promise<this>((resolve) => {
      service.activeGames.once("gameCompleted", () => {
        resolve(this);
      });
      this.store.gameResult.forceStopGame();
    });
  }

  public async fakeNeverStarted(winner?: "initiator" | "opponent") {
    return new Promise<this>((resolve) => {
      service.activeGames.once("gameCompleted", () => {
        resolve(this);
      });
      this.store.gameResult.neverStarted(
        winner
          ? {
              winnerId: this.getId(winner),
              looserId: this.getOpponentId(winner),
            }
          : undefined,
      );
    });
  }

  public getMeta() {
    return {
      matchId: this.matchId,
      game: this.activeGame.type,
      opponentId: this.opponentId,
    };
  }
}
