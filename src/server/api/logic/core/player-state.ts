import { GenericEventEmitter } from "~/lib/event-emitter";

type GeneralState = "none" | "joined" | "ready" | "in-game";
type Identity = { id: string };

export class PlayerState extends GenericEventEmitter<{
  joined: Identity;
  ready: Identity;
  disconnect: Identity;
  reconnect: Identity;
}> {
  private generalState: GeneralState = "none";
  private isConnected = false;
  private identity;

  get state() {
    return this.generalState;
  }
  /**
   * indicates if web sockets is connected
   */
  get connected() {
    return this.isConnected;
  }

  constructor(public id: string) {
    super();
    this.identity = { id };
  }

  connect() {
    this.isConnected = true;
    // assumption is that once the player is ready, a connect signal from web sockets
    // means a reconnect
    if (this.generalState !== "none" && this.generalState !== "joined") {
      this.emit("reconnect", this.identity);
    }
  }

  disconnect() {
    this.isConnected = false;
    this.emit("disconnect", this.identity);
  }

  join() {
    this.generalState = "joined";
    this.emit("joined", this.identity);
  }

  ready() {
    this.generalState = "ready";
    this.emit("ready", this.identity);
  }

  gameStart() {
    this.generalState = "in-game";
  }
}
