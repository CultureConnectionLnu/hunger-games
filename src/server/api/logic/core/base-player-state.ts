import {
  GenericEventEmitter,
  type BaseEvent,
  type DefaultEvents,
} from "~/lib/event-emitter";

type GeneralState = "none" | "joined" | "ready" | "in-game" | "game-ended";
type Identity = { id: string };

export abstract class BasePlayerState<
  SubEvents extends BaseEvent = DefaultEvents,
> extends GenericEventEmitter<
  {
    joined: Identity;
    ready: Identity;
    disconnect: Identity;
    reconnect: Identity;
  },
  SubEvents
> {
  private view: GeneralState = "none";
  private isConnected = false;
  private identity;

  get generalView() {
    return this.view;
  }

  abstract get specificView(): string;

  /**
   * indicates if web sockets is connected
   */
  get connected() {
    return this.isConnected;
  }

  private get hasCommittedToPlayTheGame() {
    // assumption is that once the player is ready, a connect signal from web sockets
    // means a reconnect
    return this.view !== "none" && this.view !== "joined";
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

    this.view = "joined";
    this.emit("joined", this.identity);
  }

  ready() {
    this.view = "ready";
    this.emit("ready", this.identity);
  }

  gameStart() {
    this.view = "in-game";
  }

  gameEnd() {
    this.view = "game-ended";
  }

  destroy() {
    this.removeAllListeners();
  }
}
