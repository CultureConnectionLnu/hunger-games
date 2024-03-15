import type { GenericEventEmitter } from "~/lib/event-emitter";
import { PlayerState } from "./player-state";
import { TimeoutCounter, type TimerEvent } from "./timeout-counter";

export type GameConfig = {
  startTimeoutInSeconds: number;
  disconnectTimeoutInSeconds: number;
  forceStopInSeconds: number;
};

/**
 * create typed events for the game
 */
export type EventTemplate<
  Events extends Record<string, unknown>,
  PlayerStates extends string,
  ServerEvents extends keyof Events = never,
  PlayerEvents extends keyof Events = keyof Events,
> = CombineIfNotNever<
  IfNotNever<
    PlayerEvents,
    ToPlayerEvent<Pick<Events, PlayerEvents>, PlayerStates>,
    never
  >,
  IfNotNever<ServerEvents, ToServerEvent<Pick<Events, ServerEvents>>, never>
>;

/**
 * correctly combine multiple events
 */
export type CombineEvents<T, K> = ServerEventsOnly<T> &
  ServerEventsOnly<K> &
  Record<`player-${string}`, ToFullPlayerEventData<T> | ToFullPlayerEventData<K>>;

type IfNotNever<Condition, True, False> = [Condition] extends [never]
  ? False
  : True;
type CombineIfNotNever<T, K> = IfNotNever<
  T,
  IfNotNever<K, K & T, T>,
  IfNotNever<K, K, never>
>;
type ToServerEvent<T> = {
  [Key in keyof T]: {
    data: T[Key];
    fightId: string;
  };
};

type ToPlayerEvent<T, States> = {
  [Key in keyof T as `player-${string}`]: {
    event: Key;
    data: T[Key];
    fightId: string;
    state: States;
  };
};

type ToUnion<T> = T[keyof T];
type ReduceToEventAndData<T> = {
  [Key in keyof T]: T[Key] extends { data: infer Data }
    ? {
        event: Key;
        data: Data;
      }
    : never;
};
type ReduceToEvent<T> = T extends {
  event: infer Event;
  data: infer Data;
}
  ? {
      event: Event;
      data: Data;
    }
  : never;
type FullPlayerData<T> = T extends {
  event: infer Event;
  data: infer Data;
  state: infer State;
  fightId: infer FightId;
}
  ? {
      event: Event;
      data: Data;
      state: State;
      fightId: FightId;
    }
  : never;

export type PlayerEventsOnly<T> = {
  [Key in keyof T as Key extends `player-${string}` ? Key : never]: T[Key];
};
export type ServerEventsOnly<T> = {
  [Key in keyof T as Key extends `player-${string}` ? never : Key]: T[Key];
};

type ToFullPlayerEventData<T> = FullPlayerData<ToUnion<PlayerEventsOnly<T>>>
export type ToPlayerEventData<T> = ReduceToEvent<ToUnion<PlayerEventsOnly<T>>>;
export type ToServerEventData<T> = ToUnion<
  ReduceToEventAndData<ServerEventsOnly<T>>
>;
export type ToEventData<T> = ToPlayerEventData<T> | ToServerEventData<T>;

export type GetPlayerStateFromEvents<T> = ToFullPlayerEventData<T>['state']

type FilterForTimeEvents<T> = T extends { data: TimerEvent; event: infer Event }
  ? Event
  : never;
export type GetTimerEvents<T> = ToUnion<{
  [Key in keyof T as FilterForTimeEvents<T[Key]> extends never
    ? never
    : Key]: FilterForTimeEvents<T[Key]>;
}>;

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
  PlayerState["state"],
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

export class GameState {
  public static nonPlayerSpecificEvents = [
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
  private disconnectedPlayers = new Set<string>();
  private players;

  private startTimeout;
  private forceTimeout;
  private disconnectedTimeout?: TimeoutCounter;

  private getEventBeforeHalted(player: string) {
    const history = this.eventHistory[player];
    if (!history) return undefined;

    return [...history].reverse().find((state) => {
      state.event !== "game-halted";
    });
  }

  constructor(
    private readonly config: GameConfig,
    private emitter: GenericEventEmitter<GeneralGameEvents>,
    private eventHistory: Record<string, ToEventData<GeneralGameEvents>[]>,
    public readonly fightId: string,
    playerIds: string[],
  ) {
    this.players = new Map<string, PlayerState>();
    playerIds.forEach((id) => {
      const player = new PlayerState(id);
      this.setupPlayerListeners(player);
      this.players.set(id, player);
    });
    this.startTimeout = new TimeoutCounter(config.startTimeoutInSeconds);
    this.setupStartTimeout();

    this.forceTimeout = new TimeoutCounter(config.forceStopInSeconds);
    // todo: introduce cancel in case of a win
    this.forceTimeout.once("timeout", () => {
      this.emitter.emit("canceled", {
        data: { reason: "force-stop" },
        fightId: this.fightId,
      });
    });
  }

  getPlayer(id: string) {
    return this.players.get(id);
  }

  assertPlayer(id: string) {
    const player = this.getPlayer(id);
    if (!player) {
      throw new Error("Player is not part of the game");
    }
    return player;
  }

  startGame() {
    this.players.forEach((x) => x.gameStart());
    this.emitEvent({
      event: "game-in-progress",
      data: undefined,
    });
  }

  endGame(winner: string) {
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
    this.startTimeout.cancel();
    this.forceTimeout.cancel();
    this.disconnectedTimeout?.cancel();

    // reset state
    this.disconnectedPlayers.clear();

    // reset listeners
    this.emitter.emit("destroy", {
      data: undefined,
      fightId: this.fightId,
    });
  }

  emitEvent(event: ToEventData<GeneralGameEvents>, player?: string) {
    if (this.isServerEvent(event)) {
      this.addToEventHistory(event);
      this.emitter.emit(event.event, {
        data: event.data,
        fightId: this.fightId,
      });
      return;
    }

    if (this.isPlayerEvent(event)) {
      this.addToEventHistory(event, player);
      if (player) {
        this.emitter.emit(`player-${player}`, {
          ...event,
          fightId: this.fightId,
          state: this.players.get(player)!.state,
        });
      } else {
        this.players.forEach((x) =>
          this.emitter.emit(`player-${x.id}`, {
            ...event,
            fightId: this.fightId,
            state: x.state,
          }),
        );
      }
    }
  }

  private isPlayerEvent(
    event: ToEventData<GeneralGameEvents>,
  ): event is ToPlayerEventData<GeneralGameEvents> {
    return GameState.playerSpecificEvents.includes(event.event);
  }

  private isServerEvent(
    event: ToEventData<GeneralGameEvents>,
  ): event is ToServerEventData<GeneralGameEvents> {
    return GameState.nonPlayerSpecificEvents.includes(event.event);
  }

  private addToEventHistory(
    event: ToEventData<GeneralGameEvents>,
    player?: string,
  ) {
    if (!player) {
      this.players.forEach((x) => {
        this.eventHistory[x.id]?.push(event);
      });
    } else {
      this.eventHistory[player]?.push(event);
    }
  }

  private setupPlayerListeners(player: PlayerState) {
    this.handleConnectDisconnect(player);
    this.handleJoinAndReady(player);
  }

  private handleJoinAndReady(player: PlayerState) {
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
      this.startTimeout.cancel();
    }
  }

  private handleConnectDisconnect(player: PlayerState) {
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
    this.setupTimeoutCounter(this.startTimeout, "start-timer", "start-timeout");
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
}
