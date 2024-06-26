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

export const rockPaperScissorsItemsSchema = z.enum([
  "rock",
  "paper",
  "scissors",
]);

type PlayerChooseItem = z.infer<typeof rockPaperScissorsItemsSchema>;
export type GameEvaluation = {
  item: PlayerChooseItem;
  beats: PlayerChooseItem[];
};

export type RockPaperScissorsConfig = {
  chooseTimeoutInSeconds: number;
  nextRoundTimeoutInSeconds: number;
  bestOf: number;
  evaluation: GameEvaluation[];
};

export type RockPaperScissorsEvents = EventTemplate<
  {
    // for all player at once
    "enable-choose": undefined;
    // for the player that already chose
    "show-waiting": {
      doneChoosing: string[];
    };
    "show-result": {
      outcome: "draw" | "win" | "lose";
      anotherRound: boolean;
      wins: number;
      loses: number;
      yourName: string;
      opponentName: string;
    };
    "choose-timer": TimerEvent;
    "next-round-timer": TimerEvent;
    destroy: undefined;
  },
  RpsPlayer["view"],
  "destroy",
  | "enable-choose"
  | "show-waiting"
  | "show-result"
  | "choose-timer"
  | "next-round-timer"
>;

class RpsPlayer extends GenericEventEmitter<{
  chosen: {
    id: string;
    item: PlayerChooseItem;
  };
}> {
  private _view: "none" | "start-choose" | "chosen" | "show-result" = "none";
  private item?: PlayerChooseItem;

  get view() {
    return this._view;
  }

  get selectedItem() {
    return this.item;
  }

  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {
    super();
  }

  enableChoose() {
    this._view = "start-choose";
  }

  choose(item: PlayerChooseItem) {
    if (this._view !== "start-choose") {
      throw new Error(`Player can't choose right now`);
    }

    this._view = "chosen";
    this.item = item;
    this.emit("chosen", {
      id: this.id,
      item,
    });
  }

  showResult() {
    this._view = "show-result";
    this.item = undefined;
  }

  cleanup() {
    this.removeAllListeners();
  }
}

export class RpsGame
  extends GenericEventEmitter<RockPaperScissorsEvents>
  implements SpecificGame
{
  private readonly players = new Map<string, RpsPlayer>();
  private timerHandler;
  private winners: string[] = [];
  private endGame?: (winnerId: string, loserId: string) => void;
  private readonly config: RockPaperScissorsConfig = rockPaperScissorsConfig;

  private get hasStarted() {
    return this.endGame !== undefined;
  }

  private emitEvent: (
    eventData: ToEventData<RockPaperScissorsEvents>,
    playerId?: string,
  ) => void;
  public getEventHistory: (playerId: string) => UnspecificPlayerEventData[];

  constructor(
    fightId: string,
    readonly playerTuple: { id: string; name: string }[],
  ) {
    super();
    this.setupPlayers(playerTuple);

    const eventing = new GameEventingHandler<RockPaperScissorsEvents>({
      emit: this.emit.bind(this),
      fightId,
      playerIds: playerTuple.map((x) => x.id),
      getView: (playerId) => this.players.get(playerId)!.view,
      playerSpecificEvents: [
        "enable-choose",
        "show-waiting",
        "show-result",
        "choose-timer",
        "next-round-timer",
      ],
      serverSpecificEvents: ["destroy"],
    });
    this.emitEvent = eventing.emitEvent.bind(eventing);
    this.getEventHistory = eventing.getPlayerEvents.bind(eventing);

    this.timerHandler = new GameTimerHandler<RockPaperScissorsEvents>(
      this.emitEvent,
      [
        {
          name: "choose-timer",
          time: this.config.chooseTimeoutInSeconds,
          timeoutEvent: () => this.evaluateState(),
        },
        {
          name: "next-round-timer",
          time: this.config.nextRoundTimeoutInSeconds,
          timeoutEvent: () => setTimeout(() => this.startChoose()),
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

  startGame(endGame: (winnerId: string, loserId: string) => void): void {
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

  private startChoose() {
    this.players.forEach((player) => player.enableChoose());
    this.emitEvent({
      event: "enable-choose",
      data: undefined,
    });
    this.timerHandler.startTimer("choose-timer");
  }

  private setupPlayers(playerTuple: { id: string; name: string }[]) {
    playerTuple.forEach(({ id, name }) => {
      const player = new RpsPlayer(id, name);
      this.players.set(id, player);
      this.handleChoose(player);
    });
  }

  private handleChoose(player: RpsPlayer) {
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

  private getWinLoseRate(playerId: string) {
    const wins = this.winners.filter((winner) => winner === playerId).length;
    const loses = this.winners.length - wins;
    return { wins, loses };
  }

  private evaluateState() {
    const [player1, player2] = [...this.players.values()] as [
      RpsPlayer,
      RpsPlayer,
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
              ...this.getWinLoseRate(id),
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
            outcome: id === result.winner ? "win" : "lose",
            anotherRound: !overAllWinner,
            yourName: name,
            opponentName: opponent,
            ...this.getWinLoseRate(id),
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

  private findWinner(firstPlayer: RpsPlayer, secondPlayer: RpsPlayer) {
    if (
      firstPlayer.selectedItem === undefined &&
      secondPlayer.selectedItem === undefined
    ) {
      return {
        winner: undefined,
        loser: undefined,
        draw: true,
      } as const;
    }
    if (firstPlayer.selectedItem === undefined) {
      return {
        winner: secondPlayer.id,
        loser: firstPlayer.id,
        draw: false,
      } as const;
    }

    if (secondPlayer.selectedItem === undefined) {
      return {
        winner: firstPlayer.id,
        loser: secondPlayer.id,
        draw: false,
      } as const;
    }

    if (firstPlayer.selectedItem === secondPlayer.selectedItem) {
      return {
        winner: null,
        loser: null,
        draw: true,
      } as const;
    }

    const firstPlayerBeats = this.config.evaluation.find(
      (item) => item.item === firstPlayer.selectedItem,
    )!.beats;

    if (firstPlayerBeats.includes(secondPlayer.selectedItem)) {
      return {
        winner: firstPlayer.id,
        loser: secondPlayer.id,
        draw: false,
      } as const;
    }

    const secondPlayerBeats = this.config.evaluation.find(
      (item) => item.item === secondPlayer.selectedItem,
    )!.beats;

    if (secondPlayerBeats.includes(firstPlayer.selectedItem)) {
      return {
        winner: secondPlayer.id,
        loser: firstPlayer.id,
        draw: false,
      } as const;
    }

    return {
      winner: null,
      loser: null,
      draw: true,
    } as const;
  }
}
