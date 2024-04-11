import {
  GenericEventEmitter,
} from "~/lib/event-emitter";

type GeneralState = "none" | "joined" | "ready" | "in-game" | "game-ended";
type Identity = { id: string };

export class BasePlayer extends GenericEventEmitter<{
  joined: Identity;
  ready: Identity;
  disconnect: Identity;
  reconnect: Identity;
}> {
  private _view: GeneralState = "none";
  private isConnected = false;
  private identity;

  get view() {
    return this._view;
  }

  /**
   * indicates if web sockets is connected
   */
  get connected() {
    return this.isConnected;
  }

  private get hasCommittedToPlayTheGame() {
    // assumption is that once the player is ready, a connect signal from web sockets
    // means a reconnect
    return this._view !== "none" && this._view !== "joined";
  }

  constructor(public id: string) {
    super();
    this.identity = { id };
  }

  connect() {
    this.isConnected = true;
    if (this.hasCommittedToPlayTheGame) {
      this.emit("reconnect", this.identity);
    }
  }

  disconnect() {
    this.isConnected = false;
    if (this.hasCommittedToPlayTheGame) {
      this.emit("disconnect", this.identity);
    }
  }

  join() {
    if (this.hasCommittedToPlayTheGame) return;

    this._view = "joined";
    this.emit("joined", this.identity);
  }

  ready() {
    this._view = "ready";
    this.emit("ready", this.identity);
  }

  gameStart() {
    this._view = "in-game";
  }

  gameEnd() {
    this._view = "game-ended";
  }

  cleanup() {
    this.removeAllListeners();
  }
}
