import { GenericEventEmitter } from "~/lib/event-emitter";
import { orderedMemoryConfig } from "../config";
import type { SpecificGame } from "../core/base-game";
import { GameEventingHandler } from "../core/game-parts/eventing";
import { GameTimerHandler } from "../core/game-parts/timer";
import { type TimerEvent } from "../core/timer";
import type {
  EventTemplate,
  ToEventData,
  UnspecificPlayerEventData,
} from "../core/types";

export type OrderedMemoryConfig = {
  showPatternTimeoutInSeconds: number;
  inputPatternTimeoutInSeconds: number;
  nextRoundTimeoutInSeconds: number;
};

const MAX_CELL_COUNT = 16;

type PatternEntry = Position & { order: number };
type InputEntry = Position & { isFail: boolean };
type Position = { col: number; row: number };

export type OrderedMemoryEvents = EventTemplate<
  {
    // send the pattern the user has to reproduce
    "show-pattern": {
      pattern: PatternEntry[];
    };
    // user can start reproducing the pattern
    "enable-input": undefined;
    // user input was correct or incorrect
    "input-response": {
      pattern: InputEntry[];
    };
    // user that finished or user that did a wrong input
    "show-waiting": undefined;
    "show-result": {
      outcome: "draw";
      yourName: string;
      opponentName: string;
    };
    "show-timer": TimerEvent;
    "input-timer": TimerEvent;
    "next-round-timer": TimerEvent;
    destroy: undefined;
  },
  OMPlayer["view"],
  "destroy",
  | "show-pattern"
  | "enable-input"
  | "input-response"
  | "show-waiting"
  | "show-result"
  | "show-timer"
  | "input-timer"
  | "next-round-timer"
>;

class OMPlayer extends GenericEventEmitter<{
  click: {
    id: string;
  };
}> {
  private _view:
    | "show-pattern"
    | "input-pattern"
    | "wait-for-opponent"
    | "show-result"
    | "none" = "none";
  private inputs: InputEntry[] = [];

  get view() {
    return this._view;
  }

  get inputEntries() {
    return this.inputs;
  }

  constructor(
    public readonly id: string,
    public readonly name: string,
    private readonly evalClick: (
      currentInputs: InputEntry[],
      position: Position,
    ) => { isFail: boolean },
  ) {
    super();
  }

  enableInput() {
    this._view = "input-pattern";
  }

  playerClick(position: Position) {
    if (this._view !== "input-pattern") {
      throw new Error(`Player can't click right now`);
    }
    const newInput = {
      ...position,
      isFail: this.evalClick(this.inputs, position).isFail,
    };
    this.inputs.push(newInput);

    this.emit("click", { id: this.id });
  }

  markAsDone() {
    this._view = "wait-for-opponent";
  }

  showResult() {
    this._view = "show-result";
    this.inputs = [];
  }

  showPattern() {
    this._view = "show-pattern";
  }

  cleanup() {
    this.removeAllListeners();
  }
}

export class OMGame
  extends GenericEventEmitter<OrderedMemoryEvents>
  implements SpecificGame
{
  private readonly players = new Map<string, OMPlayer>();
  private timerHandler;
  private roundsCounter = 1;
  private currentPattern: PatternEntry[] = [];
  public disableRandom = false;
  private endGame?: (winnerId: string, looserId: string) => void;
  private readonly config: OrderedMemoryConfig = orderedMemoryConfig;

  private get hasStarted() {
    return this.endGame !== undefined;
  }

  private emitEvent: (
    eventData: ToEventData<OrderedMemoryEvents>,
    playerId?: string,
  ) => void;
  public getEventHistory: (playerId: string) => UnspecificPlayerEventData[];

  constructor(
    fightId: string,
    readonly playerTuple: { id: string; name: string }[],
  ) {
    super();
    this.setupPlayers(playerTuple);

    const eventing = new GameEventingHandler<OrderedMemoryEvents>({
      emit: this.emit.bind(this),
      fightId,
      playerIds: playerTuple.map((x) => x.id),
      getView: (playerId) => this.players.get(playerId)!.view,
      playerSpecificEvents: [
        "show-pattern",
        "enable-input",
        "input-response",
        "show-waiting",
        "show-result",
        "show-timer",
        "input-timer",
        "next-round-timer",
      ],
      serverSpecificEvents: ["destroy"],
    });
    this.emitEvent = eventing.emitEvent.bind(eventing);
    this.getEventHistory = eventing.getPlayerEvents.bind(eventing);

    this.timerHandler = new GameTimerHandler<OrderedMemoryEvents>(
      this.emitEvent,
      [
        {
          name: "show-timer",
          time: this.config.showPatternTimeoutInSeconds,
          timeoutEvent: () => this.enableInputForPlayers(),
        },
        {
          name: "input-timer",
          time: this.config.inputPatternTimeoutInSeconds,
          timeoutEvent: () => this.evaluateState(),
        },
        {
          name: "next-round-timer",
          time: this.config.nextRoundTimeoutInSeconds,
          timeoutEvent: () => setTimeout(() => this.showPattern()),
        },
      ],
    );
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
    this.showPattern();
  }

  playerClick(playerId: string, position: Position) {
    this.assertGameHasStarted();
    this.assertPlayer(playerId).playerClick(position);
  }

  pauseGame() {
    this.timerHandler.pauseAllTimers();
  }

  resumeGame() {
    this.timerHandler.resumeAllTimers();
  }

  private enableInputForPlayers() {
    this.players.forEach((player) => {
      player.enableInput();
      this.emitEvent(
        {
          event: "enable-input",
          data: undefined,
        },
        player.id,
      );
    });
    this.timerHandler.startTimer("input-timer");
  }

  private showPattern() {
    this.currentPattern = this.getNextPattern();
    this.players.forEach((player) => player.showPattern());
    this.emitEvent({
      event: "show-pattern",
      data: { pattern: this.currentPattern },
    });
    this.timerHandler.startTimer("show-timer");
  }

  private getNextPattern(): PatternEntry[] {
    const rounds = Math.min(MAX_CELL_COUNT, this.roundsCounter);
    this.roundsCounter++;

    /**
     * index of array: order in which it has to be clicked
     * number: cell index (row * column + column)
     */
    const allAvailableCells = Array.from(
      { length: MAX_CELL_COUNT },
      (_, i) => i,
    );
    const shuffledCells = this.disableRandom
      ? allAvailableCells
      : allAvailableCells.sort(() => Math.random() - 0.5);

    return shuffledCells.slice(0, rounds).map((originalIndex, index) => {
      const col = originalIndex % 4;
      const row = Math.floor(originalIndex / 4);
      return { col, row, order: index + 1 };
    });
  }

  private setupPlayers(playerTuple: { id: string; name: string }[]) {
    playerTuple.forEach(({ id, name }) => {
      const player = new OMPlayer(id, name, this.handleClickEval.bind(this));
      this.players.set(id, player);
      this.handleClick(player);
    });
  }

  private handleClickEval(currentInputs: InputEntry[], { col, row }: Position) {
    const currentOrder = currentInputs.length + 1;
    const expected = this.currentPattern[currentOrder - 1];

    if (!expected) {
      return { isFail: true };
    }
    return {
      isFail: expected.col !== col || expected.row !== row,
    };
  }

  private handleClick(player: OMPlayer) {
    player.on("click", (e) => {
      const currentPlayer = this.assertPlayer(e.id);
      this.emitEvent(
        {
          event: "input-response",
          data: { pattern: currentPlayer.inputEntries },
        },
        e.id,
      );

      if (currentPlayer.inputEntries.length !== this.currentPattern.length) {
        return;
      }
      // current player done
      currentPlayer.markAsDone();
      this.emitEvent(
        {
          event: "show-waiting",
          data: undefined,
        },
        e.id,
      );

      if (
        ![...this.players.values()].every(
          (player) => player.view === "wait-for-opponent",
        )
      ) {
        return;
      }
      // all players done
      this.timerHandler.cancelTimer("input-timer");
      this.evaluateState();
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
      OMPlayer,
      OMPlayer,
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
        this.emitEvent(
          {
            event: "show-result",
            data: {
              outcome: "draw",
              yourName: name,
              opponentName: opponent,
            },
          },
          id,
        );
      });
      this.timerHandler.startTimer("next-round-timer");
      return;
    }

    this.endGame!(
      result.winner,
      player1.id === result.winner ? player2.id : player1.id,
    );
  }

  private findWinner(firstPlayer: OMPlayer, secondPlayer: OMPlayer) {
    const firstPlayerDone = firstPlayer.view === "wait-for-opponent";
    const secondPlayerDone = secondPlayer.view === "wait-for-opponent";
    if (!firstPlayerDone && !secondPlayerDone) {
      return {
        winner: undefined,
        looser: undefined,
        draw: true,
      } as const;
    }

    if (!firstPlayerDone) {
      return {
        winner: firstPlayer.id,
        looser: secondPlayer.id,
        draw: false,
      } as const;
    }

    if (!secondPlayerDone) {
      return {
        winner: secondPlayer.id,
        looser: firstPlayer.id,
        draw: false,
      } as const;
    }

    const firstPlayerMadeMistake = firstPlayer.inputEntries.some(
      (x) => x.isFail,
    );
    const secondPlayerMadeMistake = secondPlayer.inputEntries.some(
      (x) => x.isFail,
    );

    if (
      (!firstPlayerMadeMistake && !secondPlayerMadeMistake) ||
      (firstPlayerMadeMistake && secondPlayerMadeMistake)
    ) {
      return {
        winner: undefined,
        looser: undefined,
        draw: true,
      } as const;
    }

    if (firstPlayerMadeMistake) {
      return {
        winner: secondPlayer.id,
        looser: firstPlayer.id,
        draw: false,
      } as const;
    }

    return {
      winner: firstPlayer.id,
      looser: secondPlayer.id,
      draw: false,
    } as const;
  }
}
