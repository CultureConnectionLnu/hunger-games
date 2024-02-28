import { GenericEventEmitter } from "~/lib/event-emitter";
import { PlayerState } from "./player-state";
import { TimeoutCounter } from "./timeout-counter";

type GameConfig = {
  startTimeoutInSeconds: number;
  disconnectTimeoutInSeconds: number;
  forceStopInSeconds: number;
};

type GeneralGameEvents = {
  "player-joined-readying": {
    joined: string[];
    ready: string[];
  };
  "start-timer": {
    startTimeUnix: number;
    timeoutAfterSeconds: number;
    secondsLeft: number;
  };
  "disconnect-timer": {
    startTimeUnix: number;
    timeoutAfterSeconds: number;
    secondsLeft: number;
  };
  "all-player-ready": undefined;
  "game-in-progress": undefined;
  "game-ended": {
    winner: string;
  };
  "game-halted": {
    disconnected: string[];
  };
  "game-resume": {
    lastEvent: EmitEvent;
  };
  canceled: {
    reason: "start-timeout" | "disconnect-timeout" | "force-stop";
  };
};

export type ToEvent<T> = {
  [Key in keyof T]: {
    event: Key;
    data: T[Key];
  };
}[keyof T];
type EmitEvent = ToEvent<GeneralGameEvents>;

export type ToPlayerEvent<T, States> = {
  [Key in keyof T]: {
    event: Key;
    data: T[Key];
    fightId: string;
    state: States;
  };
}[keyof T];
export type PlayerEvent = ToPlayerEvent<
  GeneralGameEvents,
  PlayerState["state"]
>;

export class GameState extends GenericEventEmitter<
  Record<`player-${string}`, PlayerEvent> &
    Pick<
      GeneralGameEvents,
      (typeof GameState)["nonPlayerSpecificEvents"][number]
    > & {
      destroy: undefined;
    }
> {
  private static nonPlayerSpecificEvents = [
    "canceled",
    "all-player-ready",
    "game-in-progress",
    "game-ended",
  ] as const;

  private eventHistory: EmitEvent[] = [];
  private disconnectedPlayers = new Set<string>();
  private players;

  private startTimeout;
  private forceTimeout;
  private disconnectedTimeout?: TimeoutCounter;

  get allEvents() {
    return [...this.eventHistory];
  }

  get currentState() {
    return this.eventHistory[this.eventHistory.length - 1]?.event;
  }

  private get eventBeforeHalted() {
    return [...this.eventHistory].reverse().find((state) => {
      state.event !== "game-halted";
    });
  }

  constructor(
    private readonly config: GameConfig,
    public readonly fightId: string,
    playerIds: string[],
  ) {
    super();
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
    this.forceTimeout.on("timeout", () => {
      this.emit("canceled", {
        reason: "force-stop",
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
    this.emitGameEvent({
      event: "game-in-progress",
      data: undefined,
    });
  }

  endGame(winner: string) {
    this.assertPlayer(winner);
    this.emitGameEvent({
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
    this.eventHistory = [];
    this.disconnectedPlayers.clear();

    // reset listeners
    this.emit('destroy', undefined);
    this.removeAllListeners();
  }

  private emitGameEvent(event: EmitEvent) {
    this.eventHistory.push(event);

    if (
      event.event === GameState.nonPlayerSpecificEvents[0] ||
      event.event === GameState.nonPlayerSpecificEvents[1] ||
      event.event === GameState.nonPlayerSpecificEvents[2] ||
      event.event === GameState.nonPlayerSpecificEvents[3]
    ) {
      this.emit(event.event, event.data);
    }

    this.players.forEach((x) =>
      this.emit(`player-${x.id}`, {
        ...event,
        fightId: this.fightId,
        state: x.state,
      }),
    );
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
    this.emitGameEvent({
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
      this.emitGameEvent({
        event: "all-player-ready",
        data: undefined,
      });
      this.startTimeout.cancel();
    }
  }

  private handleConnectDisconnect(player: PlayerState) {
    player.on("disconnect", ({ id }) => {
      this.disconnectedPlayers.add(id);
      this.emitGameEvent({
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
        this.emitGameEvent({
          event: "game-halted",
          data: {
            disconnected: [...this.disconnectedPlayers],
          },
        });
        return;
      }
      this.emitGameEvent({
        event: "game-resume",
        data: {
          // must exist, because a connection itself already produces an event
          lastEvent: this.eventBeforeHalted!,
        },
      });

      this.disconnectedTimeout?.cancel();
      this.disconnectedTimeout = undefined;
    });
  }

  private setupStartTimeout() {
    this.startTimeout.once("timeout", () => {
      this.emitGameEvent({
        event: "canceled",
        data: {
          reason: "start-timeout",
        },
      });
    });

    this.startTimeout.once("start", (e) => {
      this.emitGameEvent({
        event: "start-timer",
        data: {
          ...e,
          secondsLeft: e.timeoutAfterSeconds,
        },
      });
    });
    this.startTimeout.on("countdown", (e) => {
      this.emitGameEvent({
        event: "start-timer",
        data: e,
      });
    });
  }

  private setupDisconnectTimeout() {
    if (!this.disconnectedTimeout) {
      console.error("disconnected timeout should be defined");
      return;
    }

    // todo: check if all timer events can be aligned
    this.disconnectedTimeout.once("timeout", () => {
      this.emitGameEvent({
        event: "canceled",
        data: {
          reason: "disconnect-timeout",
        },
      });
    });

    this.disconnectedTimeout.once("start", (e) => {
      this.emitGameEvent({
        event: "disconnect-timer",
        data: {
          ...e,
          secondsLeft: e.timeoutAfterSeconds,
        },
      });
    });
    this.disconnectedTimeout.on("countdown", (e) => {
      this.emitGameEvent({
        event: "disconnect-timer",
        data: e,
      });
    });
  }
}
