/* eslint-disable @typescript-eslint/ban-ts-comment */
import { z } from "zod";
import { env } from "~/env";
import { GenericEventEmitter } from "~/lib/event-emitter";
import { GameState, type ToPlayerEvent } from "./server-state";
import { TimeoutCounter } from "./timeout-counter";

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

type PlayerState = "none" | "join" | "ready" | "choose";

type PlayerStateData = {
  state: PlayerState;
  item: null | PlayerChooseItem;
  id: string;
};

type RockPaperScissorsEvents = {
  "player-choose": {
    doneChoosing: string[];
  };
  "all-player-choose": undefined;
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

type Identity = { id: string };
class RockPaperScissorsPlayer extends GenericEventEmitter<{
  'start-choose': Identity
}> {
  private generalState: "none" | "start-choose" | "waiting" | "show-result" | "end" =
    "none";

  get state() {
    return this.generalState;
  }

  constructor(public readonly id: string) {
    super();
  }

  startChoose(){
    this.generalState = 'start-choose'
  }
}

export class RockPaperScissorsMatch extends GenericEventEmitter<
  Record<
    `player-${string}`,
    ToPlayerEvent<RockPaperScissorsEvents, RockPaperScissorsPlayer["state"]>
  >
> {
  public readonly gameState;
  private players;
  private rpsRunning = false;
  private nextRoundTimeout?: TimeoutCounter;
  private chooseTimeout?: TimeoutCounter;

  get allEvents() {
    return [...this.gameState.allEvents];
  }

  constructor(fightId: string, playerIds: string[]) {
    super();
    this.players = new Map<string, RockPaperScissorsPlayer>();
    playerIds.forEach((id) => {
      const player = new RockPaperScissorsPlayer(id);
      this.players.set(id, player);
    });
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

    player.state = "choose";
    player.item = choice;

    if (!this.areAllPlayerInState("choose")) {
      return;
    }
  }

  destroy() {
    // reset timers
    this.nextRoundTimeout?.cancel();
    this.chooseTimeout?.cancel();

    // reset state
    this.gameState.destroy();

    // reset listeners
    this.removeAllListeners();
  }

  private startGame(){
    this.players.forEach(p => {
      p.
    })
  }

  private evaluateState() {
    clearTimeout(this.timeout!);
    this.timeout = null;

    const playerStates = Object.values(this.baseState.players);
    if (playerStates.length > 2) {
      throw new Error("Not implemented for more than 2 players");
    }

    const [player1, player2] = playerStates as [
      PlayerStateData,
      PlayerStateData,
    ];
    const result = this.findWinner(player1, player2);
    if (result.draw) {
      this.emitGameEvent({
        state: "evaluate",
        data: {
          anotherRound: true,
          winner: [],
          looser: [],
          draw: true,
        },
      });
      return;
    }

    this.baseState.winner.push(result.winner);
    const overAllWinner = this.getWinner();
    this.emitGameEvent({
      state: "evaluate",
      data: {
        anotherRound: !overAllWinner,
        winner: [result.winner],
        looser: [result.looser],
        draw: false,
      },
    });

    if (!overAllWinner) {
      Object.values(this.baseState.players).forEach((player) => {
        player.state = "ready";
        player.item = null;
      });
      this.timeout = setTimeout(() => {
        this.evaluateState();
      }, GameConfig.chooseTimeoutInSeconds * 1000);
    } else {
      this.emitGameEvent({
        state: "end",
        data: {
          winner: overAllWinner[0],
        },
      });
    }
  }

  private getWinner() {
    const winCount = this.baseState.winner.reduce<Record<string, number>>(
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
    firstPlayer: PlayerStateData,
    secondPlayer: PlayerStateData,
  ) {
    if (firstPlayer.item === null) {
      return {
        winner: secondPlayer.id,
        looser: firstPlayer.id,
        draw: false,
      } as const;
    }

    if (secondPlayer.item === null) {
      return {
        winner: firstPlayer.id,
        looser: secondPlayer.id,
        draw: false,
      } as const;
    }

    if (firstPlayer.item === secondPlayer.item) {
      return {
        winner: null,
        looser: null,
        draw: true,
      } as const;
    }

    const firstPlayerBeats = GameConfig.evaluation.find(
      (item) => item.item === firstPlayer.item,
    )!.beats;

    if (firstPlayerBeats.includes(secondPlayer.item)) {
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

  private emitGameEvent(event: EmitEvent) {
    this.eventHistory.push(event);

    this.players.forEach((x) =>
      this.emit(`player-${x.id}`, {
        ...event,
        fightId: this.fightId,
        state: x.state,
      }),
    );
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
}
