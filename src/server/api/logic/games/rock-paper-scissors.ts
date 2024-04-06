import { z } from "zod";
import { env } from "~/env";
import { BaseGameState, type GeneralGameEvents } from "../core/base-game-state";
import { BasePlayerState } from "../core/base-player-state";
import { TimerFactory, type Timer } from "../core/timeout-counter";
import type { EventTemplate, OnlyPlayerEvents } from "../core/types";

export const rockPaperScissorsItemsSchema = z.enum([
  "rock",
  "paper",
  "scissors",
]);
const longAssTime = 1_000_000;

const GameConfig = {
  get startTimeoutInSeconds() {
    return env.FEATURE_GAME_TIMEOUT ? 30 : longAssTime;
  },
  get disconnectTimeoutInSeconds() {
    return env.FEATURE_GAME_TIMEOUT ? 60 * 60 : longAssTime;
  },
  get forceStopInSeconds() {
    return env.FEATURE_GAME_TIMEOUT ? 1000 * 60 * 60 : longAssTime;
  },
  get chooseTimeoutInSeconds() {
    return env.FEATURE_GAME_TIMEOUT ? 5 : longAssTime;
  },
  get nextRoundTimeoutInSeconds() {
    // should not be affected by the feature flag
    return 5;
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
      yourWin: boolean;
      wins: number;
      looses: number;
      draw: boolean;
      opponentId: string;
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
  {
    general: BasePlayerState["generalView"];
    specific: RpsPlayer["specificView"];
  },
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
  private gameSpecificState:
    | "none"
    | "start-choose"
    | "chosen"
    | "show-result" = "none";
  private item?: PlayerChooseItem;

  get specificView() {
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

  showResult() {
    this.gameSpecificState = "show-result";
    this.item = undefined;
  }
}

export class RpsGame extends BaseGameState<RockPaperScissorsEvents> {
  protected readonly eventHistory: Record<
    string,
    (
      | OnlyPlayerEvents<GeneralGameEvents>
      | OnlyPlayerEvents<RockPaperScissorsEvents>
    )[]
  > = {};
  protected readonly players = new Map<string, RpsPlayer>();
  private winners: string[] = [];
  private nextRoundTimeout?: Timer;
  private chooseTimeout?: Timer;

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
          .filter((x) => x.specificView === "chosen")
          .map((x) => x.id);
        this.emitEvent(
          {
            event: "show-waiting",
            data: { doneChoosing },
          },
          e.id,
        );
        if (doneChoosing.length !== this.players.size) return;

        this.chooseTimeout?.cancel();
        this.evaluateState();
      });
    });
    this.init();
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
    this.players.forEach((player) => player.enableChoose());
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
    this.chooseTimeout = TimerFactory.instance.create(
      GameConfig.chooseTimeoutInSeconds,
      "choose-item",
    );

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
    this.nextRoundTimeout = TimerFactory.instance.create(
      GameConfig.nextRoundTimeoutInSeconds,
      "next-round",
    );

    // todo: check if all timer events can be aligned
    this.nextRoundTimeout.once("timeout", () => {
      setTimeout(() => {
        this.startGame();
      });
    });
    this.nextRoundTimeout.on("countdown", (e) => {
      this.emitEvent({
        event: "next-round-timer",
        data: e,
      });
    });
  }

  private getWinLooseRate(playerId: string) {
    const wins = this.winners.filter((winner) => winner === playerId).length;
    const looses = this.winners.length - wins;
    return { wins, looses };
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

    const playerStats = [...this.players.values()].map((x) => x.id);

    if (result.draw) {
      playerStats.forEach((id) => {
        this.emitEvent(
          {
            event: "show-result",
            data: {
              yourWin: false,
              anotherRound: true,
              ...this.getWinLooseRate(id),
              draw: true,
              opponentId: id === player1.id ? player2.id : player1.id,
            },
          },
          id,
        );
      });
      this.setupNextRoundTimeout();
      return;
    }

    this.winners.push(result.winner);
    const overAllWinner = this.getWinner();
    playerStats.forEach((id) => {
      this.emitEvent(
        {
          event: "show-result",
          data: {
            yourWin: id === result.winner,
            anotherRound: !overAllWinner,
            ...this.getWinLooseRate(id),
            draw: false,
            opponentId: id === player1.id ? player2.id : player1.id,
          },
        },
        id,
      );
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

    const winsNeeded =
      Math.ceil(GameConfig.bestOf / 2) + (GameConfig.bestOf % 2);

    return Object.entries(winCount).find(([, count]) => count >= winsNeeded);
  }

  private findWinner(firstPlayer: RpsPlayer, secondPlayer: RpsPlayer) {
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

    const secondPlayerBeats = GameConfig.evaluation.find(
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
