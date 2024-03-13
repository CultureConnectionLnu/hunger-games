import { GenericEventEmitter } from "~/lib/event-emitter";
import {
  GameState,
  type GameConfig,
  type GeneralGameEvents,
  type ToEventData,
  type ToPlayerEventData,
  type ToServerEventData,
} from "./game-state";

export type Player<State> = {
  readonly id: string;
  state: State;
  destroy(): void;
};

export abstract class BaseGame<
  Events extends GeneralGameEvents,
  States,
  PlayerClass extends new (id: string) => Player<States>,
> extends GenericEventEmitter<Events> {
  private readonly gameState;
  protected players;
  protected gameRunning = false;
  private eventHistory: Record<string, ToEventData<Events>[]> = {};
  protected abstract readonly playerSpecificEvents: string[];
  protected abstract readonly nonPlayerSpecificEvents: string[];

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
      this.eventHistory[id] = [];
    });

    if (this.players.size > 2) {
      throw new Error("Not implemented for more than 2 players");
    }

    this.gameState = new GameState(
      config,
      this,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.eventHistory,
      fightId,
      playerIds,
    );
    this.setupGameStartListener();
  }

  getEventHistory(playerId: string) {
    return this.eventHistory[playerId] ?? [];
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
  }

  protected endGame(winner: string) {
    this.gameState.endGame(winner);
  }

  /**
   * emit to all players if playerId is undefined
   * @returns
   */
  protected emitEvent(event: ToEventData<Events>, player?: string) {
    if (this.isServerEvent(event)) {
      this.addToEventHistory(event);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      super.emit(event.event, {
        data: event.data,
        fightId: this.fightId,
      });
      return;
    }

    if (this.isPlayerEvent(event)) {
      this.addToEventHistory(event, player);
      if (player) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        super.emit(`player-${player}`, {
          ...event,
          fightId: this.fightId,
          state: this.players.get(player)!.state,
        });
      } else {
        this.players.forEach((x) =>
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          super.emit(`player-${x.id}`, {
            ...event,
            fightId: this.fightId,
            state: x.state,
          }),
        );
      }
    }
  }

  private isPlayerEvent(
    event: ToEventData<Events>,
  ): event is ToPlayerEventData<Events> {
    return this.playerSpecificEvents.includes(event.event as string);
  }

  private isServerEvent(
    event: ToEventData<Events>,
  ): event is ToServerEventData<Events> {
    return this.nonPlayerSpecificEvents.includes(event.event as string);
  }

  private addToEventHistory(event: ToEventData<Events>, player?: string) {
    if (!player) {
      this.players.forEach((x) => {
        this.eventHistory[x.id]?.push(event);
      });
    } else {
      this.eventHistory[player]?.push(event);
    }
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

  private setupGameStartListener() {
    this.once("all-player-ready", () => {
      this.gameRunning = true;
      this.gameState.startGame();
      this.startGame();
    });
  }
}
