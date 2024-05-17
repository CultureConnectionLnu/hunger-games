import { GenericEventEmitter } from "~/lib/event-emitter";
import type { SpecificGame } from "../core/base-game";
import { GameEventingHandler } from "../core/game-parts/eventing";
import { GameTimerHandler } from "../core/game-parts/timer";
import { type TimerEvent } from "../core/timer";
import type {
  EventTemplate,
  ToEventData,
  UnspecificPlayerEventData,
} from "../core/types";
import { typingConfig } from "../config";
import { typingTexts } from "./typing-texts";
import { Temporal } from "@js-temporal/polyfill";

export type TypingConfig = {
  writingTimeInSeconds: number;
  nextRoundTimeInSeconds: number;
  timePenaltyPerMistakeInSeconds: number;
};

export type TypingPlayerState = NonNullable<TypingPlayer["states"]>;

export type TypingEvents = EventTemplate<
  {
    "provide-text": {
      text: string;
    };
    "show-waiting": undefined;
    "show-result": {
      outcome: "draw";
      yourName: string;
      opponentName: string;
    };
    "typing-timer": TimerEvent;
    "next-round-timer": TimerEvent;
    destroy: undefined;
  },
  TypingPlayer["view"],
  "destroy",
  | "provide-text"
  | "show-result"
  | "typing-timer"
  | "show-waiting"
  | "next-round-timer"
>;

class TypingPlayer extends GenericEventEmitter<{
  "finish-typing": { id: string };
}> {
  private _view:
    | "none"
    | "enable-typing"
    | "typing"
    | "waiting-for-opponent"
    | "show-result" = "none"; // Currently displayed screen for the player

  private _states?: {
    startTime: number;
    mistakes: number;
    progress: number;
    totalTime?: number;
  };

  get view() {
    return this._view;
  }

  get states() {
    return this._states;
  }

  constructor(
    public readonly id: string,
    public readonly name: string,
    private readonly getCurrentTime: () => number,
    private readonly evalText: (text: string) => {
      mistakes: number;
      progress: number;
      done: boolean;
    },
  ) {
    super();
  }

  reportText(text: string) {
    this._view = "typing";
    if (!this._states) {
      this._states = {
        startTime: this.getCurrentTime(),
        mistakes: 0,
        progress: 0,
      };
    }
    const result = this.evalText(text);
    if (result.done) {
      this._view = "waiting-for-opponent";
      this.emit("finish-typing", { id: this.id });
      return;
    }
    this._states.mistakes = result.mistakes;
    this._states.progress = result.progress;
  }

  endTyping() {
    if (!this._states) return;
    if (this._states.totalTime) return;
    // don't change the time if already set
    this._states.totalTime = this.getCurrentTime() - this._states.startTime;
  }

  showResult() {
    this._view = "show-result";
  }

  enableWrite() {
    this._view = "enable-typing";
    this._states = undefined;
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
  private endGame?: (winnerId: string, looserId: string) => void;
  private readonly config: TypingConfig = typingConfig;
  private textToType?: string;
  private fixedText?: string;

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
      playerSpecificEvents: [
        "provide-text",
        "show-result",
        "show-waiting",
        "typing-timer",
      ],
      serverSpecificEvents: ["destroy"],
    });
    this.emitEvent = eventing.emitEvent.bind(eventing);
    this.getEventHistory = eventing.getPlayerEvents.bind(eventing);

    this.timerHandler = new GameTimerHandler<TypingEvents>(this.emitEvent, [
      {
        name: "typing-timer",
        time: this.config.writingTimeInSeconds,
        timeoutEvent: () => this.evaluateState(),
      },
      {
        name: "next-round-timer",
        time: this.config.nextRoundTimeInSeconds,
        timeoutEvent: () => this.provideText(),
      },
    ]);
  }

  useFixedText(text: string) {
    this.fixedText = text;
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

  playerReportStats(playerId: string, text: string) {
    this.assertGameHasStarted();
    const player = this.assertPlayer(playerId);
    player.reportText(text);
  }

  startGame(endGame: (winnerId: string, looserId: string) => void): void {
    this.endGame = endGame;
    this.provideText();
  }

  pauseGame() {
    this.timerHandler.pauseAllTimers();
  }

  resumeGame() {
    this.timerHandler.resumeAllTimers();
  }

  private provideText() {
    this.players.forEach((player) => player.enableWrite());
    this.textToType = this.fixedText ?? this.getText();
    this.emitEvent({
      event: "provide-text",
      data: { text: this.textToType },
    });
    this.timerHandler.startTimer("typing-timer");
  }

  private getText() {
    const pick = Math.random() * typingTexts.texts.length;
    const text = typingTexts.texts[pick];
    if (text === undefined) {
      console.error(
        `No text found. Available texts '${typingTexts.texts.length}' and picked index '${pick}`,
      );
      return "This is a backup text for the typing game. Please contact the admin to fix this issue.";
    }
    return text;
  }

  private setupPlayers(playerTuple: { id: string; name: string }[]) {
    playerTuple.forEach(({ id, name }) => {
      const player = new TypingPlayer(
        id,
        name,
        () => Date.now(),
        (text) => {
          const progress = text.length / this.textToType!.length;
          const done = text.length === this.textToType!.length;
          let mistakes = 0;
          for (let index = 0; index < text.length; index++) {
            const char = text[index];
            const expectedChar = this.textToType![index];
            if (char !== expectedChar) mistakes++;
          }
          return { mistakes, progress, done };
        },
      );
      this.players.set(id, player);
      this.handleDoneTyping(player);
    });
  }

  private handleDoneTyping(player: TypingPlayer) {
    player.on("finish-typing", (e) => {
      const doneTyping = [...this.players.values()]
        .filter((x) => x.view === "waiting-for-opponent")
        .map((x) => x.id);
      this.emitEvent(
        {
          event: "show-waiting",
          data: undefined,
        },
        e.id,
      );
      const player = this.assertPlayer(e.id);
      player.endTyping();
      if (doneTyping.length !== this.players.size) return;

      this.timerHandler.cancelTimer("typing-timer");
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

  private endTyping() {
    this.players.forEach((player) => player.endTyping());
  }

  private evaluateState() {
    this.endTyping();
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

    this.endGame!(result.winner, result.loser);
  }

  private findWinner(firstPlayer: TypingPlayer, secondPlayer: TypingPlayer) {
    const firstPlayerStartedWriting =
      firstPlayer.states?.totalTime !== undefined;
    const secondPlayerStartedWriting =
      secondPlayer.states?.totalTime !== undefined;

    if (!firstPlayerStartedWriting && !secondPlayerStartedWriting) {
      return {
        winner: undefined,
        loser: undefined,
        draw: true,
      } as const;
    }
    if (!firstPlayerStartedWriting) {
      return {
        winner: secondPlayer.id,
        loser: firstPlayer.id,
        draw: false,
      } as const;
    }
    if (!secondPlayerStartedWriting) {
      return {
        winner: firstPlayer.id,
        loser: secondPlayer.id,
        draw: false,
      } as const;
    }

    const scoreFirstPlayer = this.getTypingScore(firstPlayer);
    const scoreSecondPlayer = this.getTypingScore(secondPlayer);

    if (scoreFirstPlayer === scoreSecondPlayer) {
      return {
        winner: undefined,
        loser: undefined,
        draw: true,
      } as const;
    }
    if (scoreFirstPlayer < scoreSecondPlayer) {
      return {
        winner: firstPlayer.id,
        loser: secondPlayer.id,
        draw: false,
      } as const;
    }
    return {
      winner: secondPlayer.id,
      loser: firstPlayer.id,
      draw: false,
    } as const;
  }

  private getTypingScore(player: TypingPlayer) {
    const { mistakes, totalTime } = player.states!;
    const totalTimeDate = new Date(totalTime!);
    const time = Temporal.PlainTime.from({
      second: totalTimeDate.getSeconds(),
      minute: totalTimeDate.getMinutes(),
      hour: totalTimeDate.getHours(),
    });
    const seconds = time.second + time.minute * 60 + time.hour * 60 * 60;
    return seconds + mistakes * this.config.timePenaltyPerMistakeInSeconds;
  }
}
