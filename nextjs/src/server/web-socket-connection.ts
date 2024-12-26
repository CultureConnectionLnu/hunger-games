import { type SignedInAuthObject } from "@clerk/backend/internal";
import { type WebSocket } from "ws";
import { type GameEntry } from "./service/game-service";
import { service } from "./service/references";
import { type RockPaperScissorsItem } from "./stores/games/rock-paper-scissors-slice";

type KnownErrorReasons = "no-game-found" | "wrong-game-type" | "game-logic";
type KnownActions = "pause" | "connect" | "ready" | "choose";

export class WebSocketConnection {
  private currentGame?: GameEntry;

  constructor(
    private ws: WebSocket,
    private auth: SignedInAuthObject,
  ) {
    this.init();
  }

  private init() {
    service.game.listenForPlayerJoiningGame(this.auth.userId, (game) => {
      this.currentGame = game;
      this.sendJoinGame();
    });

    this.currentGame = service.game.getGameOfPlayer(this.auth.userId);
    if (this.currentGame !== undefined) {
      this.sendJoinGame();
    }

    this.ws.on("close", () => {
      this.onWebSocketDisconnect();
    });

    // todo: handle incoming messages properly
    this.ws.on("message", (message) => {
      console.log(`Received message: ${message}`);
      this.ws.send(`Server: ${message}`);
    });
  }

  // #region events from client side

  private onWebSocketDisconnect() {
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

    this.currentGame.game.roomInteractions.connectPlayer(this.auth.userId);
  }

  private onReadyMark() {
    if (this.currentGame === undefined) {
      this.sendError("no-game-found", "ready");
      return;
    }

    this.currentGame.game.roomInteractions.markReady(this.auth.userId);
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

    const errorDetails = this.currentGame.game.gameInteractions.chooseItem(
      this.auth.userId,
      choice,
    );
    if (errorDetails) {
      this.sendError("game-logic", "choose", errorDetails);
    }
  }

  // #endregion

  // #endregion

  // #region events from server side

  private sendJoinGame() {
    // todo: send a 'join' message to the client
  }

  private sendError(
    reason: KnownErrorReasons,
    action: KnownActions,
    details?: string,
  ) {
    // todo: send an error message to the client
  }
  // #endregion
}
