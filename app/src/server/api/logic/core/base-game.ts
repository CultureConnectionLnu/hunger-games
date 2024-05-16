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
      opponentName: string;
      opponentStatus: "none" | "joined" | "ready";
    };
    "start-timer": TimerEvent;
    "disconnect-timer": TimerEvent;
    "all-player-ready": undefined;
    "game-in-progress": undefined;
    "game-ended": {
      winnerId: string;
      loserId: string;
    };
    "game-aborted": undefined;
    "game-halted": {
      disconnected: string[];
    };
    "game-resume": undefined;
    destroy: undefined;
  },
  BasePlayer["view"],
  | "all-player-ready"
  | "game-in-progress"
  | "game-ended"
  | "game-aborted"
  | "destroy",
  | "player-joined-readying"
  | "start-timer"
  | "disconnect-timer"
  | "game-in-progress"
  | "game-ended"
  | "game-halted"
  | "game-resume"
  | "game-aborted"
>;

export type BaseGamePlayerEvents = OnlyPlayerEvents<GeneralGameEvents>;

type GameState = "none" | "initialized" | "running" | "ended" | "aborted";
export type SpecificGame = {
  pauseGame: () => void;
  resumeGame: () => void;
  startGame: (endGame: (winnerId: string, loserId: string) => void) => void;
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

  public get isAborted() {
    return this.state === "aborted";
  }

  protected emitEvent: (
    eventData: ToEventData<GeneralGameEvents>,
    playerId?: string,
  ) => void;
  public getEventHistory: (playerId: string) => UnspecificPlayerEventData[];

  constructor(
    public readonly fightId: string,
    readonly playerTuple: { id: string; name: string }[],
    private readonly specificGame: SpecificGame,
  ) {
    super();

    this.setupPlayers(playerTuple);
    this.setupGameStartListener();

    const eventing = new GameEventingHandler<GeneralGameEvents>({
      emit: this.emit.bind(this),
      fightId,
      playerIds: playerTuple.map((x) => x.id),
      getView: (playerId) => this.players.get(playerId)!.view,
      playerSpecificEvents: [
        "player-joined-readying",
        "start-timer",
        "disconnect-timer",
        "game-in-progress",
        "game-ended",
        "game-halted",
        "game-resume",
        "game-aborted",
      ],
      serverSpecificEvents: [
        "destroy",
        "all-player-ready",
        "game-in-progress",
        "game-ended",
        "game-aborted",
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
        timeoutEvent: () => this.onStartTimeout(),
      },
      {
        name: "disconnect-timer",
        time: this.config.disconnectTimeoutInSeconds,
      },
      {
        name: "force-game-end",
        time: this.config.forceStopInSeconds,
        timeoutEvent: () => {
          this.abortGame();
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
        this.abortGame();
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

  endGame(winnerId: string, loserId: string) {
    this.state = "ended";
    this.assertPlayer(winnerId);
    this.assertPlayer(loserId);

    this.players.forEach((x) => x.gameEnd());
    this.emitEvent({
      event: "game-ended",
      data: {
        winnerId,
        loserId: loserId,
      },
    });
  }

  private onStartTimeout() {
    const ids = [...this.players.keys()];

    const playerOne = this.assertPlayer(ids[0]!);
    const playerTwo = this.assertPlayer(ids[1]!);

    const noOneIsready = !playerOne.isReadyToPlay && !playerTwo.isReadyToPlay;

    if (noOneIsready) {
      this.abortGame();
      return;
    }

    if (playerOne.isReadyToPlay) {
      this.endGame(playerOne.id, playerTwo.id);
    }
    this.endGame(playerTwo.id, playerOne.id);
  }

  private abortGame() {
    this.state = "aborted";

    this.players.forEach((x) => x.gameEnd());
    this.emitEvent({
      event: "game-aborted",
      data: undefined,
    });
  }
  private assertPlayer(id: string) {
    const player = this.getPlayer(id);
    if (!player) {
      throw new Error("Player is not part of the game");
    }
    return player;
  }

  private setupPlayers(playerTuples: { id: string; name: string }[]) {
    playerTuples.forEach(({ id, name }) => {
      const player = new BasePlayer(id, name);
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
    playerArray.forEach((player) => {
      const { name, view } = playerArray.find((x) => x !== player)!;
      this.emitEvent(
        {
          event: "player-joined-readying",
          data: {
            opponentName: name,
            opponentStatus:
              view === "joined" || view === "ready" ? view : "none",
          },
        },
        player.id,
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
