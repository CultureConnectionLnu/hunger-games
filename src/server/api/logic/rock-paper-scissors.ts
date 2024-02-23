/* eslint-disable @typescript-eslint/ban-ts-comment */
import { z } from "zod";
import { BaseGame } from "./base-game";
import { env } from "~/env";

export const rockPaperScissorsItemsSchema = z.enum([
  "rock",
  "paper",
  "scissors",
]);

const GameConfig = {
  get joinTimeoutInSeconds() {
    return env.FEATURE_GAME_TIMEOUT ? 30 : Number.POSITIVE_INFINITY;
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

type ServerStateData = {
  init: {
    joinTimeoutInSeconds: number;
    startTime: Date;
  };
  joined: {
    expectedPlayers: string[];
    playerMissing: string[];
  };
  allJoined: {
    players: string[];
  };
  start: {
    chooseTimeoutInSeconds: number;
    startTime: Date;
  };
  evaluate: {
    anotherRound: boolean;
    winner: string[];
    looser: string[];
    draw: boolean;
  };
  end: {
    winner: string;
  };
};

type SimpleGameEvent<T extends keyof ServerStateData> = {
  state: T;
  data: ServerStateData[T];
};

type GameEvent<T extends keyof ServerStateData> = SimpleGameEvent<T> & {
  fightId: string;
  players: string[];
};

export type AnyGameEvent = GameEvent<keyof ServerStateData>;

export class RockPaperScissorsMatch extends BaseGame<{ event: AnyGameEvent }> {
  private events: AnyGameEvent[] = [];
  private state;
  private timeout: NodeJS.Timeout | null = null;

  get allEvents() {
    return [...this.events];
  }

  constructor(fightId: string, players: string[]) {
    super(fightId, players);
    this.state = {
      server: "init" as keyof ServerStateData,
      players: players.reduce<Record<string, PlayerStateData>>(
        (acc, player) => {
          acc[player] = {
            state: "none",
            item: null,
            id: player,
          };
          return acc;
        },
        {},
      ),
      winner: [] as string[],
    };
    this.emitEvent({
      state: "init",
      data: {
        joinTimeoutInSeconds: GameConfig.joinTimeoutInSeconds,
        startTime: new Date(Date.now()),
      },
    });
  }

  private emitEvent<T extends keyof ServerStateData>(
    event: SimpleGameEvent<T>,
  ) {
    const extendedEvent = {
      ...event,
      fightId: this.fightId,
      players: this.players,
    } as const;
    this.events.push(extendedEvent);
    this.emit("event", extendedEvent);

    if (event.state === "end") {
      const winner = (event as SimpleGameEvent<"end">).data.winner;
      this.emit("end", {
        winner,
      });
    }
  }

  playerJoin(playerId: string) {
    const player = this.assertPlayerExists(playerId);
    this.assertPlayerState(player, ["none"]);

    player.state = "join";

    if (this.areSomePlayerInState("join")) {
      this.emitEvent({
        state: "joined",
        data: {
          expectedPlayers: this.players,
          playerMissing: this.players.filter(
            (player) => this.state.players[player]?.state !== "join",
          ),
        },
      });
      return;
    }

    if (this.areAllPlayerInState("join")) {
      this.emitEvent({
        state: "allJoined",
        data: {
          players: this.players,
        },
      });
    }
  }

  playerReady(playerId: string) {
    const player = this.assertPlayerExists(playerId);
    this.assertPlayerState(player, ["join"]);

    player.state = "ready";

    if (!this.areAllPlayerInState("ready")) {
      return;
    }

    this.emitEvent({
      state: "start",
      data: {
        chooseTimeoutInSeconds: GameConfig.chooseTimeoutInSeconds,
        startTime: new Date(Date.now()),
      },
    });

    this.timeout = setTimeout(() => {
      this.evaluateState();
    }, GameConfig.chooseTimeoutInSeconds * 1000);
  }

  playerChoose(playerId: string, choice: PlayerChooseItem) {
    const player = this.assertPlayerExists(playerId);
    this.assertPlayerState(player, ["ready"]);

    player.state = "choose";
    player.item = choice;

    if (!this.areAllPlayerInState("choose")) {
      return;
    }
  }

  private evaluateState() {
    clearTimeout(this.timeout!);
    this.timeout = null;

    const playerStates = Object.values(this.state.players);
    if (playerStates.length > 2) {
      throw new Error("Not implemented for more than 2 players");
    }

    const [player1, player2] = playerStates as [
      PlayerStateData,
      PlayerStateData,
    ];
    const result = this.findWinner(player1, player2);
    if (result.draw) {
      this.emitEvent({
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

    this.state.winner.push(result.winner);
    const overAllWinner = this.getWinner();
    this.emitEvent({
      state: "evaluate",
      data: {
        anotherRound: !overAllWinner,
        winner: [result.winner],
        looser: [result.looser],
        draw: false,
      },
    });

    if (!overAllWinner) {
      Object.values(this.state.players).forEach((player) => {
        player.state = "ready";
        player.item = null;
      });
      this.timeout = setTimeout(() => {
        this.evaluateState();
      }, GameConfig.chooseTimeoutInSeconds * 1000);
    } else {
      this.emitEvent({
        state: "end",
        data: {
          winner: overAllWinner[0],
        },
      });
    }
  }

  private getWinner() {
    const winCount = this.state.winner.reduce<Record<string, number>>(
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

  private assertPlayerExists(playerId: string) {
    const playerState = this.state.players[playerId];
    if (!playerState) {
      throw new Error(
        "player that is not part of the game tried to ready " + playerId,
      );
    }
    return playerState;
  }
  private assertPlayerState(
    player: PlayerStateData,
    allowedStates: PlayerState[],
  ) {
    if (!allowedStates.includes(player.state)) {
      throw new Error(
        `player tried to make a move when they are not in the correct state. Current state '${player.state}' allowed states '${allowedStates.join(",")}'. Player: ${player.id}`,
      );
    }
  }

  private areAllPlayerInState(state: PlayerState) {
    return Object.values(this.state.players).every(
      (playerState) => playerState.state === state,
    );
  }

  private areSomePlayerInState(state: PlayerState) {
    return Object.values(this.state.players).some(
      (playerState) => playerState.state === state,
    );
  }

  public destroy() {
    clearTimeout(this.timeout!);
    //@ts-expect-error
    this.state = null;
    //@ts-expect-error
    this.onStateChange = null;
    //@ts-expect-error
    this.events = null;
    this.emit("destroy", undefined);
    this.removeAllListeners();
  }
}
