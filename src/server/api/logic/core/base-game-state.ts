/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  GenericEventEmitter,
  type BaseEvent,
  type DefaultEvents,
} from "~/lib/event-emitter";
import type { BasePlayerState } from "./base-player-state";
import { TimeoutCounter, type TimerEvent } from "./timeout-counter";
import type {
  EventTemplate,
  GetTimerEvents,
  ToEventData,
  ToPlayerEventData,
  ToServerEventData,
} from "./types";

export type GameConfig = {
  startTimeoutInSeconds: number;
  disconnectTimeoutInSeconds: number;
  forceStopInSeconds: number;
};

export type GeneralGameEvents = EventTemplate<
  {
    "player-joined-readying": {
      joined: string[];
      ready: string[];
    };
    "start-timer": TimerEvent;
    "disconnect-timer": TimerEvent;
    "all-player-ready": undefined;
    "game-in-progress": undefined;
    "game-ended": {
      winner: string;
    };
    "game-halted": {
      disconnected: string[];
    };
    "game-resume": {
      lastEvent: ToEventData<GeneralGameEvents>;
    };
    canceled: {
      reason: "start-timeout" | "disconnect-timeout" | "force-stop";
    };
    destroy: undefined;
  },
  BasePlayerState["state"],
  | "canceled"
  | "all-player-ready"
  | "game-in-progress"
  | "game-ended"
  | "destroy",
  | "player-joined-readying"
  | "start-timer"
  | "disconnect-timer"
  | "all-player-ready"
  | "game-in-progress"
  | "game-ended"
  | "game-halted"
  | "game-resume"
  | "canceled"
>;

export abstract class BaseGameState<
  SubEvents extends BaseEvent = DefaultEvents,
> extends GenericEventEmitter<GeneralGameEvents, SubEvents> {
  public static serverSpecificEvents = [
    "canceled",
    "all-player-ready",
    "game-in-progress",
    "game-ended",
  ] as const;
  public static playerSpecificEvents = [
    "player-joined-readying",
    "start-timer",
    "disconnect-timer",
    "all-player-ready",
    "game-in-progress",
    "game-ended",
    "game-halted",
    "game-resume",
    "canceled",
  ];
  private readonly disconnectedPlayers = new Set<string>();
  private startTimeout?: TimeoutCounter;
  private forceTimeout?: TimeoutCounter;
  private disconnectedTimeout?: TimeoutCounter;
  private initialized = false;
  private gameRunning = false;

  public get running() {
    return this.gameRunning;
  }

  private getEventBeforeHalted(player: string) {
    this.assertInitialized();
    const history = this.eventHistory[player];
    if (!history) return undefined;

    for (let index = history.length; index >= 0; index--) {
      const state = history[index];
      if (!!state && state.event !== "game-halted") return state;
    }
  }

  protected abstract players: Map<string, BasePlayerState<SubEvents>>;
  protected abstract eventHistory: Record<
    string,
    (ToEventData<GeneralGameEvents> | ToEventData<SubEvents>)[]
  >;

  constructor(
    private readonly config: GameConfig,
    public readonly fightId: string,
    private readonly playerSpecificEvents: string[],
    private readonly serverSpecificEvents: string[],
  ) {
    super();
  }

  protected abstract getPlayer(id: string): BasePlayerState | undefined;
  protected abstract assertPlayer(id: string): BasePlayerState;
  protected abstract startGame(): void;
    protected abstract resetState() :void;

  init() {
    this.initialized = true;
    this.players.forEach((player) => {
      this.setupPlayerListeners(player);
    });
    this.startTimeout = new TimeoutCounter(this.config.startTimeoutInSeconds);
    this.setupStartTimeout();

    this.forceTimeout = new TimeoutCounter(this.config.forceStopInSeconds);
    // todo: introduce cancel in case of a win
    this.forceTimeout.once("timeout", () => {
      this.emit("canceled", {
        data: { reason: "force-stop" },
        fightId: this.fightId,
      });
    });

    this.setupGameStartListener();
  }

  endGame(winner: string) {
    this.assertInitialized();
    this.assertPlayer(winner);
    this.emitEvent({
      event: "game-ended",
      data: {
        winner,
      },
    });
  }

  destroy() {
    // reset timers
    this.startTimeout?.cancel();
    this.forceTimeout?.cancel();
    this.disconnectedTimeout?.cancel();

    // reset state
    this.disconnectedPlayers.clear();
    this.players.forEach((x) => x.destroy());
    this.resetState();

    // reset listeners
    this.emit("destroy", {
      data: undefined,
      fightId: this.fightId,
    });
  }

  protected emitEvent(event: ToEventData<GeneralGameEvents>, player?: string): void;
  protected emitEvent(event: ToEventData<SubEvents>, player?: string): void;
  protected emitEvent(event: any, playerId?: string) {
    /**
     * this is a bit of a hack, but it's the only way to make sure that the event is correctly typed
     */

    if (this.isServerEvent(event)) {
      this.addToEventHistory(event as any);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.emit(event.event, {
        data: event.data,
        fightId: this.fightId,
      });
      return;
    }

    if (this.isPlayerEvent(event)) {
      this.addToEventHistory(event as any, playerId);

      // TODO: figure out how to determine which player state to send with the event
      // this will require another abstract function for sure
      // alternatively:
      // store events within the player instead of recreating it here.
      // this would also remove the need for `addToEventHistory`

      if (playerId) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.emit(`player-${playerId}`, {
          ...event,
          fightId: this.fightId,
          state: this.players.get(playerId)!.state,
        });
      } else {
        this.players.forEach((player) =>
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          this.emit(`player-${player.id}`, {
            ...event,
            fightId: this.fightId,
            state: player.state,
          }),
        );
      }
    }
  }

  getEventHistory(playerId: string) {
    return this.eventHistory[playerId] ?? [];
  }

  playerConnect(playerId: string) {
    this.assertPlayer(playerId).connect();
  }

  playerDisconnect(playerId: string) {
    this.assertPlayer(playerId).disconnect();
  }

  playerJoin(playerId: string) {
    this.assertPlayer(playerId).join();
  }

  playerReady(playerId: string) {
    this.assertPlayer(playerId).ready();
  }

  protected assertGameIsRunning() {
    if (!this.gameRunning) {
      throw new Error(`The actual game has not yet started`);
    }
  }

  private addToEventHistory(
    event: ToEventData<GeneralGameEvents | SubEvents>,
    player?: string,
  ) {
    if (player) {
      this.eventHistory[player]?.push(event);
    } else {
      this.players.forEach((x) => {
        this.eventHistory[x.id]?.push(event);
      });
    }
  }

  private assertInitialized() {
    if (!this.initialized) {
      console.error("game not initialized");
      throw new Error("Game state not initialized");
    }
  }

  private setupGameStartListener() {
    this.once("all-player-ready", () => {
      this.gameRunning = true;
      this.players.forEach((x) => x.gameStart());
      this.emitEvent({
        event: "game-in-progress",
        data: undefined,
      });
      this.startGame();
    });
  }

  private setupPlayerListeners(player: BasePlayerState) {
    this.handleConnectDisconnect(player);
    this.handleJoinAndReady(player);
  }

  private handleJoinAndReady(player: BasePlayerState) {
    player.once("joined", () => this.emitJoiningPlayingUpdate());
    player.once("ready", () => this.emitJoiningPlayingUpdate());
  }

  private emitJoiningPlayingUpdate() {
    this.emitEvent({
      event: "player-joined-readying",
      data: {
        joined: [...this.players.values()]
          .filter((x) => x.state === "joined")
          .map((x) => x.id),
        ready: [...this.players.values()]
          .filter((x) => x.state === "ready")
          .map((x) => x.id),
      },
    });
    if ([...this.players.values()].every((x) => x.state === "ready")) {
      // all players joined, so the start timeout is over
      this.emitEvent({
        event: "all-player-ready",
        data: undefined,
      });
      this.startTimeout?.cancel();
    }
  }

  private handleConnectDisconnect(player: BasePlayerState) {
    player.on("disconnect", ({ id }) => {
      this.disconnectedPlayers.add(id);
      this.emitEvent({
        event: "game-halted",
        data: {
          disconnected: [...this.disconnectedPlayers],
        },
      });
      this.disconnectedTimeout = new TimeoutCounter(
        this.config.disconnectTimeoutInSeconds,
      );
      this.setupDisconnectTimeout();
    });

    player.on("reconnect", ({ id }) => {
      this.disconnectedPlayers.delete(id);
      if (this.disconnectedPlayers.size !== 0) {
        this.emitEvent({
          event: "game-halted",
          data: {
            disconnected: [...this.disconnectedPlayers],
          },
        });
        return;
      }

      this.players.forEach((x) => {
        /**
         * typing this correctly is basically impossible because the child class introduces also new events
         */
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        this.emitEvent(
          {
            event: "game-resume",
            data: {
              lastEvent: this.getEventBeforeHalted(x.id)!,
            },
          },
          x.id,
        );
      });

      this.disconnectedTimeout?.cancel();
      this.disconnectedTimeout = undefined;
    });
  }

  private setupStartTimeout() {
    this.setupTimeoutCounter(
      this.startTimeout!,
      "start-timer",
      "start-timeout",
    );
  }

  private setupDisconnectTimeout() {
    if (!this.disconnectedTimeout) {
      console.error("disconnected timeout should be defined");
      return;
    }

    this.setupTimeoutCounter(
      this.disconnectedTimeout,
      "disconnect-timer",
      "disconnect-timeout",
    );
  }

  private setupTimeoutCounter(
    timeout: TimeoutCounter,
    countdownEvent: GetTimerEvents<GeneralGameEvents>,
    cancelReason: GeneralGameEvents["canceled"]["data"]["reason"],
  ) {
    timeout.once("timeout", () => {
      this.emitEvent({
        event: "canceled",
        data: {
          reason: cancelReason,
        },
      });
    });

    timeout.on("countdown", (e) => {
      this.emitEvent({
        event: countdownEvent,
        data: e,
      });
    });
  }

  // TODO: maybe remove the complex types as they are not used at all
  private isPlayerEvent(
    event: ToEventData<GeneralGameEvents> | ToEventData<SubEvents>,
  ): event is
    | ToPlayerEventData<GeneralGameEvents>
    | ToPlayerEventData<SubEvents> {
    return (
      BaseGameState.playerSpecificEvents.includes(event.event as string) ||
      this.playerSpecificEvents.includes(event.event as string)
    );
  }

  private isServerEvent(
    event: ToEventData<GeneralGameEvents> | ToEventData<SubEvents>,
  ): event is
    | ToServerEventData<GeneralGameEvents>
    | ToServerEventData<SubEvents> {
    return (
      BaseGameState.serverSpecificEvents.includes(event.event as string) ||
      this.serverSpecificEvents.includes(event.event as string)
    );
  }
}
