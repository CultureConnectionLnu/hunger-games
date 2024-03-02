import { GenericEventEmitter } from "~/lib/event-emitter";
import {
  GameState,
  type AllGameStateEvents,
  type GameConfig,
  type ToPlayerEvent,
} from "./game-state";

export type Player<State> = {
  readonly id: string;
  state: State;
  destroy(): void;
};

export type GetEmittedEvents<T> =
  T extends GenericEventEmitter<infer R> ? R : never;

export type GetPlayerEvents<T> =
  GetEmittedEvents<T> extends Record<`player-${string}`, infer R> ? R : never;

export abstract class BaseGame<
  Events extends Record<string, unknown>,
  States,
  EmitEvent,
  PlayerClass extends new (id: string) => Player<States>,
> extends GenericEventEmitter<
  Record<`player-${string}`, ToPlayerEvent<Events, States>> & AllGameStateEvents
> {
  private readonly gameState;
  protected players;
  protected gameRunning = false;
  private eventHistory: EmitEvent[] = [];

  get allEvents() {
    return [...this.gameState.allEvents, ...this.eventHistory];
  }

  constructor(
    config: GameConfig,
    playerClass: PlayerClass,
    public fightId: string,
    playerIds: string[],
  ) {
    super();

    this.players = new Map<string, InstanceType<PlayerClass>>();
    playerIds.forEach((id) => {
      const player = new playerClass(id);
      this.players.set(id, player as InstanceType<PlayerClass>);
    });
    if (this.players.size > 2) {
      throw new Error("Not implemented for more than 2 players");
    }

    this.gameState = new GameState(config, fightId, playerIds);
    this.setupEventForward(playerIds);
    this.setupGameStartListener();
  }

  protected abstract startGame(): void;
  protected abstract resetState(): void;

  playerConnect(playerId: string) {
    this.gameState.assertPlayer(playerId).connect();
  }

  playerDisconnect(playerId: string) {
    this.gameState.assertPlayer(playerId).disconnect();
  }

  playerJoin(playerId: string) {
    this.gameState.assertPlayer(playerId).join();
  }

  playerReady(playerId: string) {
    this.gameState.assertPlayer(playerId).ready();
  }

  destroy() {
    // reset state
    this.resetState();
    this.gameState.destroy();
    this.players.forEach((x) => x.destroy());

    // reset listeners
    this.removeAllListeners();
  }

  protected endGame(winner: string) {
    this.gameState.endGame(winner);
  }

  /**
   * emit to all players if playerId is undefined
   * @returns
   */
  protected emitGameEvent(event: EmitEvent, playerId?: string) {
    this.eventHistory.push(event);
    // This class is to generic to type it properly, therefore ts-ignore is used

    if (!playerId) {
      this.players.forEach((x) =>
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.emit(`player-${x.id}`, {
          ...event,
          fightId: this.fightId,
          state: x.state,
        }),
      );
      return;
    }
    const player = this.assertPlayer(playerId);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    this.emit(`player-${player.id}`, {
      ...event,
      fightId: this.fightId,
      state: player.state,
    });
  }

  protected assertGameIsRunning() {
    if (!this.gameRunning) {
      throw new Error(`The actual game has not yet started`);
    }
  }

  public getPlayer(id: string) {
    return this.players.get(id);
  }

  protected assertPlayer(id: string) {
    const player = this.getPlayer(id);
    if (!player) {
      throw new Error("Player is not part of the game");
    }
    return player;
  }

  private setupEventForward(playerIds: string[]) {
    playerIds.forEach((id) => {
      this.gameState.on(`player-${id}`, (eventData) =>
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.emit(`player-${id}`, eventData),
      );
    });
    GameState.nonPlayerSpecificEvents.forEach((eventName) => {
      this.gameState.on(eventName, (eventData) => {
        this.emit(eventName, eventData);
      });
    });
  }

  private setupGameStartListener() {
    this.gameState.once("all-player-ready", () => {
      this.gameRunning = true;
      this.gameState.startGame();
      this.startGame();
    });
  }
}
