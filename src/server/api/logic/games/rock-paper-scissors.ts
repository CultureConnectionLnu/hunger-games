/* eslint-disable @typescript-eslint/ban-ts-comment */
import { z } from "zod";
import { env } from "~/env";
import { GenericEventEmitter } from "~/lib/event-emitter";
import type { ToEvent, ToPlayerEvent } from "../core/game-state";
import { TimeoutCounter } from "../core/timeout-counter";
import { BaseGame } from "../core/base-game";

export const rockPaperScissorsItemsSchema = z.enum([
  "rock",
  "paper",
  "scissors",
]);

const GameConfig = {
  get startTimeoutInSeconds() {
    return env.FEATURE_GAME_TIMEOUT ? 30 : Number.POSITIVE_INFINITY;
  },
  get disconnectTimeoutInSeconds() {
    return env.FEATURE_GAME_TIMEOUT ? 60 * 60 : Number.POSITIVE_INFINITY;
  },
  get forceStopInSeconds() {
    return env.FEATURE_GAME_TIMEOUT ? 1000 * 60 * 60 : Number.POSITIVE_INFINITY;
  },
  get chooseTimeoutInSeconds() {
    return env.FEATURE_GAME_TIMEOUT ? 30 : Number.POSITIVE_INFINITY;
  },
  get nextRoundTimeoutInSeconds() {
    return env.FEATURE_GAME_TIMEOUT ? 30 : 10;
  },
  bestOf: 3,
  evaluation: [
    {
      item: "rock",
      beats: ["scissors"],
    },
    {
      item: "scissors",
      beats: ["paper"],
    },
    {
      item: "paper",
      beats: ["rock"],
    },
  ] as GameEvaluation[],
} as const;

type PlayerChooseItem = z.infer<typeof rockPaperScissorsItemsSchema>;

type GameEvaluation = {
  item: PlayerChooseItem;
  beats: PlayerChooseItem[];
};

type RockPaperScissorsEvents = {
  // for all player at once
  "enable-choose": undefined;
  // for the player that already chose
  "show-waiting": {
    doneChoosing: string[];
  };
  "show-result": {
    anotherRound: boolean;
    winner: string[];
    looser: string[];
    draw: boolean;
  };
  "choose-timer": {
    startTimeUnix: number;
    timeoutAfterSeconds: number;
    secondsLeft: number;
  };
  "next-round-timer": {
    startTimeUnix: number;
    timeoutAfterSeconds: number;
    secondsLeft: number;
  };
};
export type RockPaperScissorsPlayerEvents = ToPlayerEvent<
  RockPaperScissorsEvents,
  RockPaperScissorsPlayer["state"]
> ;

class RockPaperScissorsPlayer extends GenericEventEmitter<{
  chosen: {
    id: string;
    item: PlayerChooseItem;
  };
}> {
  private generalState: "none" | "start-choose" | "chosen" = "none";
  private item?: PlayerChooseItem;

  get state() {
    return this.generalState;
  }

  get selectedItem() {
    return this.item;
  }

  constructor(public readonly id: string) {
    super();
  }

  enableChoose() {
    this.generalState = "start-choose";
  }

  choose(item: PlayerChooseItem) {
    if (this.generalState !== "start-choose") {
      throw new Error(`Player can't choose right now`);
    }

    this.generalState = "chosen";
    this.item = item;
    this.emit("chosen", {
      id: this.id,
      item,
    });
  }

  reset() {
    this.generalState = "none";
    this.item = undefined;
  }

  destroy() {
    this.reset();
    this.removeAllListeners();
  }
}

export class RockPaperScissorsMatch extends BaseGame<
  Record<`player-${string}`, RockPaperScissorsPlayerEvents>,
  RockPaperScissorsPlayer["state"],
  ToEvent<RockPaperScissorsEvents>,
  typeof RockPaperScissorsPlayer
> {
  private winners: string[] = [];
  private nextRoundTimeout?: TimeoutCounter;
  private chooseTimeout?: TimeoutCounter;

  constructor(fightId: string, playerIds: string[]) {
    super(GameConfig, RockPaperScissorsPlayer, fightId, playerIds);

    this.players.forEach((player) => {
      player.on("chosen", (e) => {
        const doneChoosing = [...this.players.values()]
          .filter((x) => x.state === "chosen")
          .map((x) => x.id);
        this.emitGameEvent(
          {
            event: "show-waiting",
            data: { doneChoosing },
          },
          e.id,
        );
        if (doneChoosing.length !== this.players.size) return;

        // todo figure out the winner
        this.evaluateState();
      });
    });
  }

  playerChoose(playerId: string, choice: PlayerChooseItem) {
    this.assertGameIsRunning();
    const player = this.assertPlayer(playerId);
    player.choose(choice);
  }

  protected resetState() {
    // reset timers
    this.nextRoundTimeout?.cancel();
    this.chooseTimeout?.cancel();
  }

  protected startGame() {
    this.emitGameEvent({
      event: "enable-choose",
      data: undefined,
    });
    this.setupChooseTimeout();
  }

  private setupChooseTimeout() {
    this.chooseTimeout = new TimeoutCounter(GameConfig.chooseTimeoutInSeconds);

    // todo: check if all timer events can be aligned
    this.chooseTimeout.once("timeout", () => {
      this.evaluateState();
    });
    this.chooseTimeout.on("countdown", (e) => {
      this.emitGameEvent({
        event: "choose-timer",
        data: e,
      });
    });
  }

  private setupNextRoundTimeout() {
    this.nextRoundTimeout = new TimeoutCounter(
      GameConfig.nextRoundTimeoutInSeconds,
    );

    // todo: check if all timer events can be aligned
    this.nextRoundTimeout.once("timeout", () => {
      this.startGame();
    });
    this.nextRoundTimeout.on("countdown", (e) => {
      this.emitGameEvent({
        event: "next-round-timer",
        data: e,
      });
    });
  }

  private evaluateState() {
    const [player1, player2] = [...this.players.values()] as [
      RockPaperScissorsPlayer,
      RockPaperScissorsPlayer,
    ];
    const result = this.findWinner(player1, player2);
    if (result.draw) {
      this.emitGameEvent({
        event: "show-result",
        data: {
          anotherRound: true,
          winner: [],
          looser: [],
          draw: true,
        },
      });
      this.setupNextRoundTimeout();
      return;
    }

    this.winners.push(result.winner);
    const overAllWinner = this.getWinner();
    this.emitGameEvent({
      event: "show-result",
      data: {
        anotherRound: !overAllWinner,
        winner: [result.winner],
        looser: [result.looser],
        draw: false,
      },
    });

    if (!overAllWinner) {
      // continue with the next round
      this.setupNextRoundTimeout();
    } else {
      this.endGame(overAllWinner[0]);
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

    const winsNeeded = Math.ceil(GameConfig.bestOf / 2);

    return Object.entries(winCount).find(([, count]) => count >= winsNeeded);
  }

  private findWinner(
    firstPlayer: RockPaperScissorsPlayer,
    secondPlayer: RockPaperScissorsPlayer,
  ) {
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

    const firstPlayerBeats = GameConfig.evaluation.find(
      (item) => item.item === firstPlayer.selectedItem,
    )!.beats;

    if (firstPlayerBeats.includes(secondPlayer.selectedItem)) {
      return {
        winner: firstPlayer.id,
        looser: secondPlayer.id,
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
