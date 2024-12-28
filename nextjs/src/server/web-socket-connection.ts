import { type SignedInAuthObject } from "@clerk/backend/internal";
import { type WebSocket } from "ws";
import { z } from "zod";
import { service } from "./service";
import { type GameEntry } from "./service/active-games-service";
import { type ConnectionPlayerView } from "./stores/core/connection-view-slice";
import { type GameType } from "./stores/games/game-factory";
import {
  rockPaperScissorsItemSchema,
  type RockPaperScissorsItem,
} from "./stores/games/rock-paper-scissors-slice";
import { type RockPaperScissorsPlayerView } from "./stores/games/rock-paper-scissors-view-slice";

type KnownErrorReasons =
  | "no-game-found"
  | "wrong-game-type"
  | "game-logic"
  | "invalid-data";
type KnownActions = "pause" | "connect" | "ready" | "choose" | "unknown";

export class WebSocketConnection {
  private unsubscribeListeners: Array<() => void> = [];
  private _currentGame?: GameEntry;
  private get currentGame() {
    return this._currentGame;
  }
  private set currentGame(value: GameEntry | undefined) {
    this._currentGame = value;
    if (value === undefined) return;
    this.initGameStoreListeners(value);
  }

  constructor(
    private ws: WebSocket,
    private auth: SignedInAuthObject,
  ) {
    this.unsubscribeListeners.push(
      service.activeGames.listenForPlayerJoiningGame(
        this.auth.userId,
        (game) => {
          this.currentGame = game;
          // should force join the player if the person is already connected
          this.sendJoinGame(game);
        },
      ),
    );
    this.init();
  }

  private init() {
    this.currentGame = service.activeGames.getActiveGameOfPlayer(
      this.auth.userId,
    );

    this.ws.on("close", () => {
      this.onWebSocketDisconnect();
    });

    this.ws.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      if (Array.isArray(data)) {
        data.forEach((buf) => this.receiveMessageFromClient(buf.toString()));
      } else if (data instanceof ArrayBuffer) {
        this.receiveMessageFromClient(Buffer.from(data).toString());
      } else {
        this.receiveMessageFromClient(data.toString());
      }
    });
  }

  private initGameStoreListeners(entry: GameEntry) {
    const { connectedView, gameView } = entry.game.store.getState();
    const playerKey =
      connectedView.mutable.player1.id === this.auth.userId
        ? "player1"
        : "player2";

    this.unsubscribeListeners.push(
      entry.game.store.subscribe(
        (state) => state.connectedView.mutable[playerKey],
        (current, previous) => {
          if (JSON.stringify(current) !== JSON.stringify(previous)) {
            this.sendMessageToClient({
              type: "game-room",
              data: current,
            });
          }
        },
      ),
    );
    this.sendMessageToClient({
      type: "game-room",
      data: connectedView.mutable[playerKey],
    });

    if (entry.type !== "rock-paper-scissors") {
      // todo: implement once other games exits
      return;
    }

    this.unsubscribeListeners.push(
      entry.game.store.subscribe(
        (state) => state.gameView.mutable[playerKey],
        (current, previous) => {
          if (JSON.stringify(current) !== JSON.stringify(previous)) {
            this.sendMessageToClient({
              type: "game-logic",
              gameType: "rock-paper-scissors",
              data: current,
            });
          }
        },
      ),
    );
    this.sendMessageToClient({
      type: "game-logic",
      gameType: "rock-paper-scissors",
      data: gameView.mutable[playerKey],
    });
  }

  private sendMessageToClient(message: WsMessageToClient) {
    this.ws.send(JSON.stringify(message));
  }

  private receiveMessageFromClient(message: string) {
    const parsed = wsMessageFromClientSchema.safeParse(JSON.parse(message));
    if (!parsed.success) {
      this.sendError("invalid-data", "unknown", parsed.error.message);
      return;
    }

    const { data } = parsed;
    switch (data.type) {
      case "connect-to-fight":
        this.onConnectOrResumeGame();
        return;
      case "pause-game":
        this.onPauseGame();
        return;
      case "resume-game":
        this.onConnectOrResumeGame();
        return;
      case "mark-ready":
        this.onReadyMark();
        return;
    }

    data.type satisfies "game-action";

    // todo: once more games are implemented, then create proper separation
    this.onRockPaperScissorsChoose(data.data);
  }

  // #region events from client side

  private onWebSocketDisconnect() {
    this.unsubscribeListeners.forEach((unsubscribe) => unsubscribe());
    this.ws.removeAllListeners();
    if (this.currentGame === undefined) {
      return;
    }

    this.currentGame.game.roomInteractions.disconnectPlayer(this.auth.userId);
  }

  /**
   * If the user navigates away from the game page or actively presses pause button
   */
  private onPauseGame() {
    if (this.currentGame === undefined) {
      this.sendError("no-game-found", "pause");
      return;
    }

    this.currentGame.game.roomInteractions.disconnectPlayer(this.auth.userId);
  }

  /**
   * If the user navigates back to the game page or actively presses resume button
   */
  private onConnectOrResumeGame() {
    if (this.currentGame === undefined) {
      this.sendError("no-game-found", "connect");
      return;
    }

    const error = this.currentGame.game.roomInteractions.connectPlayer(
      this.auth.userId,
    );
    if (error === undefined) return;

    this.sendError("game-logic", "connect", error);
  }

  private onReadyMark() {
    if (this.currentGame === undefined) {
      this.sendError("no-game-found", "ready");
      return;
    }

    const error = this.currentGame.game.roomInteractions.markReady(
      this.auth.userId,
    );
    if (error === undefined) return;

    this.sendError("game-logic", "ready", error);
  }

  // #region game specific events

  private onRockPaperScissorsChoose(choice: RockPaperScissorsItem) {
    if (this.currentGame === undefined) {
      this.sendError("no-game-found", "choose");
      return;
    }
    if (this.currentGame.type !== "rock-paper-scissors") {
      this.sendError("wrong-game-type", "choose");
      return;
    }

    const error = this.currentGame.game.gameInteractions.chooseItem(
      this.auth.userId,
      choice,
    );
    if (error === undefined) return;

    this.sendError("game-logic", "choose", error);
  }

  // #endregion

  // #endregion

  // #region events from server side

  private sendJoinGame(gameEntry: GameEntry) {
    const playerConnection =
      gameEntry.game.store.getState().playerConnection.mutable;
    this.sendMessageToClient({
      type: "join-game",
      gameId: gameEntry.id,
      gameType: gameEntry.type,
      playerIds: [playerConnection.player1.id, playerConnection.player2.id],
    });
  }

  private sendError(
    reason: KnownErrorReasons,
    action: KnownActions,
    details?: string,
  ) {
    this.sendMessageToClient({
      type: "error",
      reason,
      action,
      details,
    });
  }
  // #endregion
}

const wsMessageFromClientSchema = z.union([
  z.object({
    type: z.literal("connect-to-fight"),
  }),
  z.object({
    type: z.literal("pause-game"),
  }),
  z.object({
    type: z.literal("resume-game"),
  }),
  z.object({
    type: z.literal("mark-ready"),
  }),
  z.object({
    type: z.literal("game-action"),
    game: z.literal("rock-paper-scissors"),
    action: z.literal("choose"),
    data: rockPaperScissorsItemSchema,
  }),
]);

export type WSMessageFromClient = z.infer<typeof wsMessageFromClientSchema>;
export type WsMessageToClient =
  | {
      type: "error";
      reason: KnownErrorReasons;
      action: KnownActions;
      details?: string;
    }
  | {
      type: "join-game";
      gameId: string;
      gameType: GameType;
      playerIds: [string, string];
    }
  | {
      type: "game-room";
      data: ConnectionPlayerView;
    }
  | {
      type: "game-logic";
      gameType: GameType;
      data: RockPaperScissorsPlayerView;
    };
