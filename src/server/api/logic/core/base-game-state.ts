/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
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
  OnlyPlayerEvents,
  ToEventData,
  UnspecificPlayerEventData,
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
      winnerId: string;
      looserId: string;
    };
    "game-halted": {
      disconnected: string[];
    };
    "game-resume": {
      lastEvent: {
        event: string;
        data: unknown;
      };
    };
    canceled: {
      reason: "start-timeout" | "disconnect-timeout" | "force-stop";
    };
    destroy: undefined;
  },
  { general: BasePlayerState["generalView"] },
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

export type BaseGamePlayerEvents = OnlyPlayerEvents<GeneralGameEvents>;

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

  private getEventBeforeHalted(
    player: string,
  ):
    | undefined
    | (OnlyPlayerEvents<GeneralGameEvents> | OnlyPlayerEvents<SubEvents>) {
    this.assertInitialized();
    const history = this.eventHistory[player];
    if (!history) return undefined;

    for (let index = history.length; index >= 0; index--) {
      /**
       * As there is a fully unknown generic included as return value for this function
       * it's impossible for typescript to determine the correct type.
       *
       * By casting it to only the known type, we can at least write the code without any errors.
       * But it is technically not the correct type and therefore unsafe code.
       */
      const state = history[index] as OnlyPlayerEvents<GeneralGameEvents>;
      if (!state) continue;
      if (state.event !== "game-halted") return state;
    }
  }

  protected abstract players: Map<string, BasePlayerState>;
  protected abstract eventHistory: Record<
    string,
    (OnlyPlayerEvents<GeneralGameEvents> | OnlyPlayerEvents<SubEvents>)[]
  >;

  constructor(
    private readonly config: GameConfig,
    public readonly fightId: string,
    public readonly playerSpecificEvents: string[],
    private readonly serverSpecificEvents: string[],
  ) {
    super();
  }

  public abstract getPlayer(id: string): BasePlayerState | undefined;
  protected abstract assertPlayer(id: string): BasePlayerState;
  protected abstract startGame(): void;
  protected abstract resetState(): void;

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

    this.players.forEach((x) => x.gameEnd());
    this.emitEvent({
      event: "game-ended",
      data: {
        winnerId: winner,
        looserId: [...this.players.values()].find((x) => x.id !== winner)!.id,
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

  protected emitEvent(
    eventData: ToEventData<GeneralGameEvents>,
    player?: string,
  ): void;
  protected emitEvent(eventData: ToEventData<SubEvents>, player?: string): void;
  protected emitEvent(eventData: any, playerId?: string) {
    /**
     * Overloading the function is the only way to type it correctly for both the current class
     * and its children.
     *
     * This entire class is not typesafe and uses any a lot.
     * Because one of the generics is not known at this point, it's impossible to type it correctly.
     */

    if (this.isServerEvent(eventData)) {
      console.log("emit server event", eventData);
      const event = {
        ...eventData,
        fightId: this.fightId,
      };
      this.emit(eventData.event, event);
    }

    if (this.isPlayerEvent(eventData)) {
      console.log("emit player event", playerId, eventData);
      if (playerId) {
        const player = this.getPlayer(playerId)!;
        this.emitPlayerEvent(eventData, player);
      } else {
        this.players.forEach((player) =>
          this.emitPlayerEvent(eventData, player),
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

  private emitPlayerEvent(eventData: any, player: BasePlayerState) {
    const event = {
      event: eventData.event,
      data: eventData.data,
      fightId: this.fightId,
      view: {
        general: player.generalView,
        specific: player.specificView,
      },
    } satisfies UnspecificPlayerEventData;
    this.addToEventHistory(event, player.id);
    this.emit(`player-${player.id}`, event);
  }

  private addToEventHistory(event: any, player: string) {
    this.eventHistory[player]?.push(event);
  }

  private assertInitialized() {
    if (!this.initialized) {
      console.error("game not initialized");
      throw new Error("Game state not initialized");
    }
  }

  private setupGameStartListener() {
    this.once("all-player-ready", () => {
      setTimeout(() => {
      /**
       * make sure that all the synchronous events are done before starting the game
       */
      this.gameRunning = true;
      this.players.forEach((x) => x.gameStart());
      this.emitEvent({
        event: "game-in-progress",
        data: undefined,
      });
      this.startGame();

      })
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
          .filter((x) => x.generalView === "joined")
          .map((x) => x.id),
        ready: [...this.players.values()]
          .filter((x) => x.generalView === "ready")
          .map((x) => x.id),
      },
    });
    if ([...this.players.values()].every((x) => x.generalView === "ready")) {
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

  private isPlayerEvent(event: { event: string }) {
    return (
      BaseGameState.playerSpecificEvents.includes(event.event) ||
      this.playerSpecificEvents.includes(event.event)
    );
  }

  private isServerEvent(event: { event: string }) {
    return (
      BaseGameState.serverSpecificEvents.includes(event.event) ||
      this.serverSpecificEvents.includes(event.event)
    );
  }
}
