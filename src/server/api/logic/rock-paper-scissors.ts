/* eslint-disable @typescript-eslint/ban-ts-comment */
import { z } from "zod";
import { env } from "~/env";
import { GenericEventEmitter } from "~/lib/event-emitter";
import { GameState, type ToEvent, type ToPlayerEvent } from "./core/game-state";
import { TimeoutCounter } from "./core/timeout-counter";

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
type EmitEvent = ToEvent<RockPaperScissorsEvents>;

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

export class RockPaperScissorsMatch extends GenericEventEmitter<
  Record<
    `player-${string}`,
    ToPlayerEvent<RockPaperScissorsEvents, RockPaperScissorsPlayer["state"]>
  >
> {
  private eventHistory: EmitEvent[] = [];
  private winners: string[] = [];
  public readonly gameState;
  private players;
  private rpsRunning = false;
  private nextRoundTimeout?: TimeoutCounter;
  private chooseTimeout?: TimeoutCounter;

  get allEvents() {
    return [...this.gameState.allEvents];
  }

  constructor(
    private fightId: string,
    playerIds: string[],
  ) {
    super();
    this.players = new Map<string, RockPaperScissorsPlayer>();
    playerIds.forEach((id) => {
      const player = new RockPaperScissorsPlayer(id);
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
      this.players.set(id, player);
    });
    if (this.players.size > 2) {
      throw new Error("Not implemented for more than 2 players");
    }

    this.gameState = new GameState(GameConfig, fightId, playerIds);
    this.gameState.once("all-player-ready", () => {
      this.rpsRunning = true;
      this.gameState.startGame();
      this.startGame();
    });
  }

  playerConnect(playerId: string) {
    this.gameState.assertPlayer(playerId).connect();
  }

  playerDisconnect(playerId: string) {
    this.gameState.assertPlayer(playerId).disconnect();
  }

  playerJoin(playerId: string) {
    this.gameState.assertPlayer(playerId).join();
  }

  playerReady(playerId: string) {
    this.gameState.assertPlayer(playerId).ready();
  }

  playerChoose(playerId: string, choice: PlayerChooseItem) {
    this.assertGameIsRunning();
    const player = this.assertPlayer(playerId);
    player.choose(choice);
  }

  destroy() {
    // reset timers
    this.nextRoundTimeout?.cancel();
    this.chooseTimeout?.cancel();

    // reset state
    this.gameState.destroy();
    this.players.forEach((x) => x.destroy());

    // reset listeners
    this.removeAllListeners();
  }

  private startGame() {
    this.emitGameEvent({
      event: "enable-choose",
      data: undefined,
    });
    this.setupChooseTimeout();
  }

  private emitGameEvent(event: EmitEvent, playerId?: string) {
    this.eventHistory.push(event);

    if (!playerId) {
      this.players.forEach((x) =>
        this.emit(`player-${x.id}`, {
          ...event,
          fightId: this.fightId,
          state: x.state,
        }),
      );
      return;
    }
    const player = this.assertPlayer(playerId);
    this.emit(`player-${player.id}`, {
      ...event,
      fightId: this.fightId,
      state: player.state,
    });
  }

  private assertGameIsRunning() {
    if (!this.rpsRunning) {
      throw new Error(`The actual game has not yet started`);
    }
  }

  private assertPlayer(id: string) {
    const player = this.players.get(id);
    if (!player) {
      throw new Error("Player is not part of the game");
    }
    return player;
  }

  private setupChooseTimeout() {
    this.chooseTimeout = new TimeoutCounter(GameConfig.chooseTimeoutInSeconds);

    // todo: check if all timer events can be aligned
    this.chooseTimeout.once("timeout", () => {
      this.evaluateState();
    });

    this.chooseTimeout.once("start", (e) => {
      this.emitGameEvent({
        event: "choose-timer",
        data: {
          ...e,
          secondsLeft: e.timeoutAfterSeconds,
        },
      });
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

    this.nextRoundTimeout.once("start", (e) => {
      this.emitGameEvent({
        event: "next-round-timer",
        data: {
          ...e,
          secondsLeft: e.timeoutAfterSeconds,
        },
      });
    });
    this.nextRoundTimeout.on("countdown", (e) => {
      this.emitGameEvent({
        event: "next-round-timer",
        data: e,
      });
    });
  }

  // old code

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
      this.gameState.endGame(overAllWinner[0]);
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
