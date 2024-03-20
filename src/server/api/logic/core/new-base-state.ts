import type { GenericEventEmitter } from "~/lib/event-emitter";
import { TimeoutCounter, type TimerEvent } from "./timeout-counter";
import type { EventTemplate, GetTimerEvents, ToEventData } from "./types";
import type { PlayerState } from "./player-state";

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

export type ImplementedGame = {
  players: Map<string, PlayerState>;
  eventHistory: Record<string, ToEventData<GeneralGameEvents>[]>;
  emitEvent(event: ToEventData<GeneralGameEvents>, player?: string): void;
  assertPlayer(id: string): PlayerState;
  startGame(): void;
};

export class BaseGameState {
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
    const history = this.game.eventHistory[player];
    if (!history) return undefined;

    return [...history].reverse().find((state) => {
      state.event !== "game-halted";
    });
  }

  constructor(
    private readonly config: GameConfig,
    private readonly fightId: string,
    private readonly emitter: GenericEventEmitter<GeneralGameEvents>,
    private readonly game: ImplementedGame,
  ) {}

  init() {
    this.initialized = true;
    this.game.players.forEach((player) => {
      this.setupPlayerListeners(player);
    });
    this.startTimeout = new TimeoutCounter(this.config.startTimeoutInSeconds);
    this.setupStartTimeout();

    this.forceTimeout = new TimeoutCounter(this.config.forceStopInSeconds);
    // todo: introduce cancel in case of a win
    this.forceTimeout.once("timeout", () => {
      this.emitter.emit("canceled", {
        data: { reason: "force-stop" },
        fightId: this.fightId,
      });
    });

    this.setupGameStartListener();
  }

  endGame(winner: string) {
    this.assertInitialized();
    this.game.assertPlayer(winner);
    this.game.emitEvent({
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
    this.game.players.forEach((x) => x.destroy());

    // reset listeners
    this.emitter.emit("destroy", {
      data: undefined,
      fightId: this.fightId,
    });
  }

  private assertInitialized() {
    if (!this.initialized) {
      console.error("game not initialized");
      throw new Error("Game state not initialized");
    }
  }

  private setupGameStartListener() {
    this.emitter.once("all-player-ready", () => {
      this.gameRunning = true;
      this.game.players.forEach((x) => x.gameStart());
      this.game.emitEvent({
        event: "game-in-progress",
        data: undefined,
      });
      this.game.startGame();
    });
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
    this.game.emitEvent({
      event: "player-joined-readying",
      data: {
        joined: [...this.game.players.values()]
          .filter((x) => x.state === "joined")
          .map((x) => x.id),
        ready: [...this.game.players.values()]
          .filter((x) => x.state === "ready")
          .map((x) => x.id),
      },
    });
    if ([...this.game.players.values()].every((x) => x.state === "ready")) {
      // all players joined, so the start timeout is over
      this.game.emitEvent({
        event: "all-player-ready",
        data: undefined,
      });
      this.startTimeout?.cancel();
    }
  }

  private handleConnectDisconnect(player: PlayerState) {
    player.on("disconnect", ({ id }) => {
      this.disconnectedPlayers.add(id);
      this.game.emitEvent({
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
        this.game.emitEvent({
          event: "game-halted",
          data: {
            disconnected: [...this.disconnectedPlayers],
          },
        });
        return;
      }

      this.game.players.forEach((x) => {
        this.game.emitEvent(
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
      this.game.emitEvent({
        event: "canceled",
        data: {
          reason: cancelReason,
        },
      });
    });

    timeout.on("countdown", (e) => {
      this.game.emitEvent({
        event: countdownEvent,
        data: e,
      });
    });
  }
}
