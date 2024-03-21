import { z } from "zod";
import { env } from "~/env";
import { BaseGameState, type GeneralGameEvents } from "../core/base-game-state";
import { BasePlayerState } from "../core/base-player-state";
import { TimeoutCounter } from "../core/timeout-counter";
import type { EventTemplate, OnlyPlayerEvents } from "../core/types";

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

export type RockPaperScissorsEvents = EventTemplate<
  {
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
  },
  RpsPlayer["gameState"],
  never,
  | "enable-choose"
  | "show-waiting"
  | "show-result"
  | "choose-timer"
  | "next-round-timer"
>;

class RpsPlayer extends BasePlayerState<{
  chosen: {
    id: string;
    item: PlayerChooseItem;
  };
}> {
  private gameSpecificState: "none" | "start-choose" | "chosen" = "none";
  private item?: PlayerChooseItem;

  get gameState() {
    return this.gameSpecificState;
  }

  get selectedItem() {
    return this.item;
  }

  enableChoose() {
    this.gameSpecificState = "start-choose";
  }

  choose(item: PlayerChooseItem) {
    if (this.gameSpecificState !== "start-choose") {
      throw new Error(`Player can't choose right now`);
    }

    this.gameSpecificState = "chosen";
    this.item = item;
    this.emit("chosen", {
      id: this.id,
      item,
    });
  }

  reset() {
    this.gameSpecificState = "none";
    this.item = undefined;
  }
}

export class RpsGame extends BaseGameState<RockPaperScissorsEvents> {
  protected readonly eventHistory: Record<
    string,
    (OnlyPlayerEvents<GeneralGameEvents> | OnlyPlayerEvents<RockPaperScissorsEvents>)[]
  > = {};
  protected readonly players = new Map<string, RpsPlayer>();
  private winners: string[] = [];
  private nextRoundTimeout?: TimeoutCounter;
  private chooseTimeout?: TimeoutCounter;

  constructor(fightId: string, playerIds: string[]) {
    super(
      GameConfig,
      fightId,
      [
        "enable-choose",
        "show-waiting",
        "show-result",
        "choose-timer",
        "next-round-timer",
      ],
      [],
    );
    playerIds.forEach((id) => {
      const player = new RpsPlayer(id);
      this.players.set(id, player);
      this.eventHistory[id] = [];

      player.on("chosen", (e) => {
        const doneChoosing = [...this.players.values()]
          .filter((x) => x.gameState === "chosen")
          .map((x) => x.id);
        this.emitEvent(
          {
            event: "show-waiting",
            data: { doneChoosing },
          },
          e.id,
        );
        if (doneChoosing.length !== this.players.size) return;

        this.evaluateState();
      });
    });
  }

  getPlayer(id: string) {
    return this.players.get(id);
  }

  assertPlayer(id: string) {
    const player = this.getPlayer(id);
    if (!player) {
      throw new Error("Player is not part of the game");
    }
    return player;
  }

  startGame(): void {
    this.emitEvent({
      event: "enable-choose",
      data: undefined,
    });
    this.setupChooseTimeout();
  }

  playerChoose(playerId: string, choice: PlayerChooseItem) {
    this.assertGameIsRunning();
    this.assertPlayer(playerId).choose(choice);
  }

  protected resetState() {
    this.nextRoundTimeout?.cancel();
    this.chooseTimeout?.cancel();
  }

  private setupChooseTimeout() {
    this.chooseTimeout = new TimeoutCounter(GameConfig.chooseTimeoutInSeconds);

    // todo: check if all timer events can be aligned
    this.chooseTimeout.once("timeout", () => {
      this.evaluateState();
    });
    this.chooseTimeout.on("countdown", (e) => {
      this.emitEvent({
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
      this.emitEvent({
        event: "next-round-timer",
        data: e,
      });
    });
  }

  private evaluateState() {
    const [player1, player2] = [...this.players.values()] as [
      RpsPlayer,
      RpsPlayer,
    ];
    const result = this.findWinner(player1, player2);
    if (result.draw) {
      this.emitEvent({
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
    this.emitEvent({
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
    firstPlayer: RpsPlayer,
    secondPlayer: RpsPlayer,
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
