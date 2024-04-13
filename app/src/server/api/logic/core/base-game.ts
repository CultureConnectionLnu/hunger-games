import { GenericEventEmitter } from "~/lib/event-emitter";
import { BasePlayer } from "./base-player";
import { GameConnectionHandler } from "./game-parts/connection";
import { GameEventingHandler } from "./game-parts/eventing";
import { GameTimerHandler } from "./game-parts/timer";
import { type TimerEvent } from "./timer";
import type {
  EventTemplate,
  OnlyPlayerEvents,
  ToEventData,
  UnspecificPlayerEventData,
} from "./types";
import { generalGameConfig } from "../config";

export type BaseGameConfig = {
  startTimeoutInSeconds: number;
  disconnectTimeoutInSeconds: number;
  forceStopInSeconds: number;
};

export type GeneralGameEvents = EventTemplate<
  {
    "player-joined-readying": {
      opponent: string;
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
    "game-resume": undefined;
    canceled: {
      reason: "start-timeout" | "disconnect-timeout" | "force-stop";
    };
    destroy: undefined;
  },
  BasePlayer["view"],
  | "canceled"
  | "all-player-ready"
  | "game-in-progress"
  | "game-ended"
  | "destroy",
  | "player-joined-readying"
  | "start-timer"
  | "disconnect-timer"
  | "game-in-progress"
  | "game-ended"
  | "game-halted"
  | "game-resume"
  | "canceled"
>;

export type BaseGamePlayerEvents = OnlyPlayerEvents<GeneralGameEvents>;

type GameState = "none" | "initialized" | "running" | "ended";
export type SpecificGame = {
  pauseGame: () => void;
  resumeGame: () => void;
  startGame: (endGame: (winnerId: string) => void) => void;
  cleanup: () => void;
};

export class BaseGame extends GenericEventEmitter<GeneralGameEvents> {
  private readonly players = new Map<string, BasePlayer>();
  private timerHandler;
  private state: GameState = "none";
  private readonly config: BaseGameConfig = generalGameConfig;

  public get isRunning() {
    return this.state === "running";
  }

  protected emitEvent: (
    eventData: ToEventData<GeneralGameEvents>,
    playerId?: string,
  ) => void;
  public getEventHistory: (playerId: string) => UnspecificPlayerEventData[];

  constructor(
    public readonly fightId: string,
    readonly playerIds: string[],
    private readonly specificGame: SpecificGame,
  ) {
    super();

    this.on("game-ended", () =>
      setTimeout(() => {
        /**
         * make sure that all the synchronous events are done before starting the game
         */
        this.destroy();
      }),
    );
    this.setupPlayers(playerIds);
    this.setupGameStartListener();

    const eventing = new GameEventingHandler({
      emit: this.emit.bind(this),
      fightId,
      playerIds,
      getView: (playerId) => this.players.get(playerId)!.view,
      playerSpecificEvents: [
        "player-joined-readying",
        "start-timer",
        "disconnect-timer",
        "game-in-progress",
        "game-ended",
        "game-halted",
        "game-resume",
        "canceled",
      ],
      serverSpecificEvents: [
        "destroy",
        "canceled",
        "all-player-ready",
        "game-in-progress",
        "game-ended",
      ],
    });

    this.emitEvent = eventing.emitEvent.bind(eventing);
    this.getEventHistory = eventing.getPlayerEvents.bind(eventing);

    this.timerHandler = new GameTimerHandler<
      GeneralGameEvents,
      "force-game-end"
    >(this.emitEvent, [
      {
        name: "start-timer",
        time: this.config.startTimeoutInSeconds,
        timeoutEvent: () => {
          this.emitEvent({
            event: "canceled",
            data: { reason: "start-timeout" },
          });
        },
      },
      {
        name: "disconnect-timer",
        time: this.config.disconnectTimeoutInSeconds,
      },
      {
        name: "force-game-end",
        time: this.config.forceStopInSeconds,
        timeoutEvent: () => {
          this.emitEvent({
            event: "canceled",
            data: { reason: "force-stop" },
          });
        },
        normal: true,
      },
    ]);
    this.timerHandler.startTimer("start-timer");
    this.timerHandler.startTimer("force-game-end");

    // this will be cleaned up automatically when player event listeners are removed
    new GameConnectionHandler({
      // @ts-expect-error It does contain the necessary disconnect event
      timerHandler: this.timerHandler,
      players: [...this.players.values()],
      emit: this.emitEvent,
      pauseGame: this.specificGame.pauseGame.bind(this.specificGame),
      resumeGame: this.specificGame.resumeGame.bind(this.specificGame),
      endGame: this.endGame.bind(this),
      cancelGame: () => {
        this.emitEvent({
          event: "canceled",
          data: { reason: "disconnect-timeout" },
        });
      },
    });
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

  getPlayer(id: string) {
    return this.players.get(id);
  }

  endGame(winner: string) {
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

  private assertPlayer(id: string) {
    const player = this.getPlayer(id);
    if (!player) {
      throw new Error("Player is not part of the game");
    }
    return player;
  }

  private setupPlayers(ids: string[]) {
    ids.forEach((id) => {
      const player = new BasePlayer(id);
      this.players.set(id, player);
      this.handleJoinAndReady(player);
    });
  }

  private handleJoinAndReady(player: BasePlayer) {
    player.once("joined", () => this.emitJoiningPlayingUpdate());
    player.once("ready", () => this.emitJoiningPlayingUpdate());
  }

  private emitJoiningPlayingUpdate() {
    const playerArray = [...this.players.values()];

    const generalEventData = {
      joined: playerArray.filter((x) => x.view === "joined").map((x) => x.id),
      ready: playerArray.filter((x) => x.view === "ready").map((x) => x.id),
    };
    const playerIds = playerArray.map((x) => x.id);
    playerIds.forEach((id) => {
      const opponent = playerIds.find((x) => x !== id);
      this.emitEvent(
        {
          event: "player-joined-readying",
          data: {
            opponent: opponent!,
            ...generalEventData,
          },
        },
        id,
      );
    });
    if ([...this.players.values()].every((x) => x.view === "ready")) {
      // all players joined, so the start timeout is over
      this.emitEvent({
        event: "all-player-ready",
        data: undefined,
      });
      this.timerHandler.cancelTimer("start-timer");
    }
  }

  private setupGameStartListener() {
    this.once("all-player-ready", () => {
      setTimeout(() => {
        /**
         * make sure that all the synchronous events are done before starting the game
         */
        this.state = "running";
        this.players.forEach((x) => x.gameStart());
        this.emitEvent({
          event: "game-in-progress",
          data: undefined,
        });
        this.specificGame.startGame(this.endGame.bind(this));
      });
    });
  }

  public destroy() {
    this.emitEvent({
      event: "destroy",
      data: undefined,
    });
    this.specificGame.cleanup();
    this.timerHandler.cleanup();
    this.players.forEach((player) => player.cleanup());
    this.removeAllListeners();
  }
}