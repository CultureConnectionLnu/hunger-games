import { GenericEventEmitter } from "~/lib/event-emitter";
import { orderedMemoryConfig, rockPaperScissorsConfig } from "../config";
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

type PatternEntry = { col: number; row: number; order: number };
type InputEntry = { col: number; row: number; isFail: boolean };

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
    "show-waiting": {
      doneInput: string[];
    };
    "show-result": {
      outcome: "draw" | "win" | "loose";
      anotherRound: boolean;
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
    col: number;
    row: number;
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
  ) {
    super();
  }

  enableInput() {
    this._view = "input-pattern";
  }

  click(col: number, row: number) {
    if (this._view !== "input-pattern") {
      throw new Error(`Player can't click right now`);
    }
    this.emit("click", { id: this.id, col, row });
  }

  showResult() {
    this._view = "show-result";
    this.inputs = [];
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
  private roundCounter = 1;
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
          timeoutEvent: () => console.log("enable players to input pattern"),
        },
        {
          name: "input-timer",
          time: this.config.inputPatternTimeoutInSeconds,
          timeoutEvent: () => console.log("evaluate and show results"),
        },
        {
          name: "next-round-timer",
          time: this.config.nextRoundTimeoutInSeconds,
          timeoutEvent: () =>
            console.log(
              "function that either ends the game or starts the next round",
            ),
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
    this.startChoose();
  }

  playerChoose(playerId: string, choice: PlayerChooseItem) {
    this.assertGameHasStarted();
    this.assertPlayer(playerId).choose(choice);
  }

  pauseGame() {
    this.timerHandler.pauseAllTimers();
  }

  resumeGame() {
    this.timerHandler.resumeAllTimers();
  }

  private showPattern() {
    const nextPattern = this.getNextPattern(this.roundCounter);
    this.roundCounter = Math.min(MAX_CELL_COUNT, this.roundCounter);
    this.emitEvent({
      event: "show-pattern",
      data: { pattern: nextPattern },
    });
    this.timerHandler.startTimer("show-timer");
  }

  private getNextPattern(roundCounter: number): PatternEntry[] {
    /**
     * index of array: order in which it has to be clicked
     * number: cell index (row * column + column)
     */
    const boardPositions: number[] = [];
    const getNextFreeCellPosition = (randomNumber: number) => {
      if (!boardPositions.includes(randomNumber)) {
        // if it is not included, then it is a valid position
        return randomNumber;
      }
      const orderedPositions = boardPositions.sort((a, b) => a - b);
      const indexOfExisting = orderedPositions.findIndex(
        (x) => x === randomNumber,
      );
      /**
       * example 1:
       * - randomNumber: 10
       * - orderedPosition: [ 10, 11, 12 ]
       * - should return 13
       *
       * example 2:
       * - randomNumber: 10
       * - orderedPosition: [ 10, 11, 13, 14, 15 ]
       * - should return 12
       */
      let nextFreePosition = randomNumber;
      for (let i = indexOfExisting; i < MAX_CELL_COUNT; i++) {
        if (orderedPositions[i] !== nextFreePosition) {
          return nextFreePosition;
        }
        nextFreePosition++;
      }

      return undefined;
    };

    for (let i = 0; i < roundCounter; i++) {
      const availableCellsCount = MAX_CELL_COUNT - i;
      const nextCell = Math.floor(Math.random() * availableCellsCount);
      const cellPosition = getNextFreeCellPosition(nextCell);
      if (cellPosition === undefined) {
        throw new Error("Could not find a free cell position");
      }
      boardPositions.push(cellPosition);
    }

    return boardPositions.map((position, index) => {
      const col = position % 4;
      const row = Math.floor(position / 4);
      return { col, row, order: index + 1 };
    });
  }

  private setupPlayers(playerTuple: { id: string; name: string }[]) {
    playerTuple.forEach(({ id, name }) => {
      const player = new OMPlayer(id, name);
      this.players.set(id, player);
      this.handleChoose(player);
    });
  }

  private handleChoose(player: OMPlayer) {
    player.on("chosen", (e) => {
      const doneChoosing = [...this.players.values()]
        .filter((x) => x.view === "chosen")
        .map((x) => x.id);
      this.emitEvent(
        {
          event: "show-waiting",
          data: { doneChoosing },
        },
        e.id,
      );
      if (doneChoosing.length !== this.players.size) return;

      this.timerHandler.cancelTimer("choose-timer");
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

  private getWinLooseRate(playerId: string) {
    const wins = this.winners.filter((winner) => winner === playerId).length;
    const looses = this.winners.length - wins;
    return { wins, looses };
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
              anotherRound: true,
              yourName: name,
              opponentName: opponent,
              ...this.getWinLooseRate(id),
            },
          },
          id,
        );
      });
      this.timerHandler.startTimer("next-round-timer");
      return;
    }

    this.winners.push(result.winner);
    const overAllWinner = this.getWinner();
    playerStats.forEach(({ id, name, opponent }) => {
      this.emitEvent(
        {
          event: "show-result",
          data: {
            outcome: id === result.winner ? "win" : "loose",
            anotherRound: !overAllWinner,
            yourName: name,
            opponentName: opponent,
            ...this.getWinLooseRate(id),
          },
        },
        id,
      );
    });

    if (!overAllWinner) {
      // continue with the next round
      this.timerHandler.startTimer("next-round-timer");
    } else {
      const winnerId = overAllWinner[0];
      this.endGame!(
        winnerId,
        player1.id === winnerId ? player2.id : player1.id,
      );
    }
  }

  private getWinner() {
    const winCount = this.winners.reduce<Record<string, number>>(
      (acc, winner) => {
        acc[winner] = (acc[winner] ?? 0) + 1;
        return acc;
      },
      {},
    );

    const winsNeeded =
      Math.ceil(this.config.bestOf / 2) + (this.config.bestOf % 2);

    return Object.entries(winCount).find(([, count]) => count >= winsNeeded);
  }

  private findWinner(firstPlayer: OMPlayer, secondPlayer: OMPlayer) {
    if (
      firstPlayer.selectedItem === undefined &&
      secondPlayer.selectedItem === undefined
    ) {
      return {
        winner: undefined,
        looser: undefined,
        draw: true,
      } as const;
    }
    if (firstPlayer.selectedItem === undefined) {
      return {
        winner: secondPlayer.id,
        looser: firstPlayer.id,
        draw: false,
      } as const;
    }

    if (secondPlayer.selectedItem === undefined) {
      return {
        winner: firstPlayer.id,
        looser: secondPlayer.id,
        draw: false,
      } as const;
    }

    if (firstPlayer.selectedItem === secondPlayer.selectedItem) {
      return {
        winner: null,
        looser: null,
        draw: true,
      } as const;
    }

    const firstPlayerBeats = this.config.evaluation.find(
      (item) => item.item === firstPlayer.selectedItem,
    )!.beats;

    if (firstPlayerBeats.includes(secondPlayer.selectedItem)) {
      return {
        winner: firstPlayer.id,
        looser: secondPlayer.id,
        draw: false,
      } as const;
    }

    const secondPlayerBeats = this.config.evaluation.find(
      (item) => item.item === secondPlayer.selectedItem,
    )!.beats;

    if (secondPlayerBeats.includes(firstPlayer.selectedItem)) {
      return {
        winner: secondPlayer.id,
        looser: firstPlayer.id,
        draw: false,
      } as const;
    }

    return {
      winner: null,
      looser: null,
      draw: true,
    } as const;
  }
}
