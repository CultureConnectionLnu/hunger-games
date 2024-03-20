import { z } from "zod";
import { env } from "~/env";
import { GenericEventEmitter } from "~/lib/event-emitter";
import { emitEventFactory } from "../core/new-base-game";
import { GeneralGameEvents, ImplementedGame } from "../core/new-base-state";
import { PlayerState } from "../core/player-state";
import { CombineEvents, EventTemplate, ToEventData } from "../core/types";

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

export type RockPaperScissorsEvents = CombineEvents<
  EventTemplate<
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
    RockPaperScissorsPlayer["state"],
    never,
    | "enable-choose"
    | "show-waiting"
    | "show-result"
    | "choose-timer"
    | "next-round-timer"
  >,
  GeneralGameEvents
>;

export class RpsGame
  extends GenericEventEmitter<RockPaperScissorsEvents>
  implements ImplementedGame
{
  private readonly eventHistory: Record<
    string,
    ToEventData<RockPaperScissorsEvents>[]
  > = {};
  private readonly emitEvent;
  private readonly players = new Map<string, RockPaperScissorsPlayer>();

  constructor(fightId: string, playerIds: string[]) {
    super();
    playerIds.forEach((id) => {
      const player = new playerClass(id);
      this.players.set(id, player as InstanceType<PlayerClass>);
      this.eventHistory[id] = [];
    });

    this.emitEvent = emitEventFactory({
      emitter: this,
      nonPlayerSpecificEvents: GameState.nonPlayerSpecificEvents,
      playerSpecificEvents: GameState.playerSpecificEvents,
      fightId,
    });
  }

  getPlayer(id: string) {
    return this.players.get(id);
  }
  assertPlayer(id: string): PlayerState {
    const player = this.getPlayer(id);
    if (!player) {
      throw new Error("Player is not part of the game");
    }
    return player;
  }
  startGame(): void {
    throw new Error("Method not implemented.");
  }
}
