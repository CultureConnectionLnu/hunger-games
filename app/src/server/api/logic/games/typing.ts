import { z } from "zod";
import { GenericEventEmitter } from "~/lib/event-emitter";
import { rockPaperScissorsConfig } from "../config";
import type { SpecificGame } from "../core/base-game";
import { GameEventingHandler } from "../core/game-parts/eventing";
import { GameTimerHandler } from "../core/game-parts/timer";
import { type TimerEvent } from "../core/timer";
import type {
  EventTemplate,
  ToEventData,
  UnspecificPlayerEventData,
} from "../core/types";

export type TypingEvents = EventTemplate<
  {
    //TODO insert game events
    destroy: undefined;
  },
  TypingPlayer["view"],
  "destroy"
>;

class TypingPlayer extends GenericEventEmitter<{}> {
  private _view:
    | "none"
    | "start-typing"
    | "waiting-for-opponent"
    | "show-result" = "none"; // Currently displayed screen for the player

  get view() {
    return this._view;
  }

  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {
    super();
  }

  showResult() {
    this._view = "show-result";
  }

  cleanup() {
    this.removeAllListeners();
  }
}

export class TypingGame
  extends GenericEventEmitter<TypingEvents>
  implements SpecificGame
{
  private readonly players = new Map<string, TypingPlayer>();
  private timerHandler;
  private winners: string[] = [];
  private endGame?: (winnerId: string, looserId: string) => void;

  private get hasStarted() {
    return this.endGame !== undefined;
  }

  private emitEvent: (
    eventData: ToEventData<TypingEvents>,
    playerId?: string,
  ) => void;
  public getEventHistory: (playerId: string) => UnspecificPlayerEventData[];

  constructor(
    fightId: string,
    readonly playerTuple: { id: string; name: string }[],
  ) {
    super();
    this.setupPlayers(playerTuple);

    const eventing = new GameEventingHandler<TypingEvents>({
      emit: this.emit.bind(this),
      fightId,
      playerIds: playerTuple.map((x) => x.id),
      getView: (playerId) => this.players.get(playerId)!.view,
      playerSpecificEvents: [],
      serverSpecificEvents: ["destroy"],
    });
    this.emitEvent = eventing.emitEvent.bind(eventing);
    this.getEventHistory = eventing.getPlayerEvents.bind(eventing);

    this.timerHandler = new GameTimerHandler<TypingEvents>(this.emitEvent, []);
  }

  getPlayer(id: string) {
    return this.players.get(id);
  }

  cleanup() {
    this.emitEvent({
      event: "destroy",
      data: undefined,
    });
    this.timerHandler.cleanup();
    this.players.forEach((player) => player.cleanup());
    this.removeAllListeners();
  }

  startGame(endGame: (winnerId: string, looserId: string) => void): void {
    this.endGame = endGame;
    //TODO implement startChoose function from rps, but for typing game.
  }

  pauseGame() {
    this.timerHandler.pauseAllTimers();
  }

  resumeGame() {
    this.timerHandler.resumeAllTimers();
  }

  private setupPlayers(playerTuple: { id: string; name: string }[]) {
    playerTuple.forEach(({ id, name }) => {
      const player = new TypingPlayer(id, name);
      this.players.set(id, player);
    });
  }

  private assertPlayer(id: string) {
    const player = this.getPlayer(id);
    if (!player) {
      throw new Error("Player is not part of the game");
    }
    return player;
  }

  private assertGameHasStarted() {
    if (!this.hasStarted) {
      throw new Error(`The game has not been started yet`);
    }
  }

  private evaluateState() {
    const [player1, player2] = [...this.players.values()] as [
      TypingPlayer,
      TypingPlayer,
    ];
    const result = this.findWinner(player1, player2);

    // make sure the correct view state for players is set
    player1.showResult();
    player2.showResult();

    const playerStats = [
      { id: player1.id, name: player1.name, opponent: player2.name },
      { id: player2.id, name: player2.name, opponent: player1.name },
    ];

    if (result.draw) {
      playerStats.forEach(({ id, name, opponent }) => {
        // this.emitEvent(
        //   {
        //     event: "show-result",
        //     data: {
        //       outcome: "draw",
        //       anotherRound: true,
        //       yourName: name,
        //       opponentName: opponent,
        //       ...this.getWinLooseRate(id),
        //     },
        //   },
        //   id,
        // );
      });
      return;
    }

    playerStats.forEach(({ id, name, opponent }) => {
      // this.emitEvent(
      //   {
      //     event: "show-result",
      //     data: {
      //       outcome: id === result.winner ? "win" : "loose",
      //       anotherRound: !overAllWinner,
      //       yourName: name,
      //       opponentName: opponent,
      //       ...this.getWinLooseRate(id),
      //     },
      //   },
      //   id,
      // );
    });

    this.endGame!(
      result.winner,
      player1.id === result.winner ? player2.id : player1.id,
    );
  }

  private findWinner(firstPlayer: TypingPlayer, secondPlayer: TypingPlayer) {
    // TODO implement evaluation who wins
    return {
      winner: firstPlayer.id,
      looser: secondPlayer.id,
      draw: false,
    } as const;
  }
}
