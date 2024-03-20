import type { GenericEventEmitter } from "~/lib/event-emitter";
import { PlayerState } from "./player-state";
import { TimeoutCounter, type TimerEvent } from "./timeout-counter";

/**
 * correctly combine multiple events
 */

export type GetPlayerStateFromEvents<T> = ToFullPlayerEventData<T>["state"];

export class GameState {
  public static nonPlayerSpecificEvents = [
    "canceled",
    "all-player-ready",
    "game-in-progress",
    "game-ended",
  ] as const;
  public static playerSpecificEvents = [
    "player-joined-readying",
    "start-timer",
    "disconnect-timer",
    "all-player-ready",
    "game-in-progress",
    "game-ended",
    "game-halted",
    "game-resume",
    "canceled",
  ];
  private disconnectedPlayers = new Set<string>();
  private players;

  private startTimeout;
  private forceTimeout;
  private disconnectedTimeout?: TimeoutCounter;

  constructor(
    private readonly config: GameConfig,
    private emitter: GenericEventEmitter<GeneralGameEvents>,
    private eventHistory: Record<string, ToEventData<GeneralGameEvents>[]>,
    public readonly fightId: string,
    playerIds: string[],
  ) {
  }


  assertPlayer(id: string) {
  }

  emitEvent(event: ToEventData<GeneralGameEvents>, player?: string) {
    if (this.isServerEvent(event)) {
      this.addToEventHistory(event);
      this.emitter.emit(event.event, {
        data: event.data,
        fightId: this.fightId,
      });
      return;
    }

    if (this.isPlayerEvent(event)) {
      this.addToEventHistory(event, player);
      if (player) {
        this.emitter.emit(`player-${player}`, {
          ...event,
          fightId: this.fightId,
          state: this.players.get(player)!.state,
        });
      } else {
        this.players.forEach((x) =>
          this.emitter.emit(`player-${x.id}`, {
            ...event,
            fightId: this.fightId,
            state: x.state,
          }),
        );
      }
    }
  }

  private isPlayerEvent(
    event: ToEventData<GeneralGameEvents>,
  ): event is ToPlayerEventData<GeneralGameEvents> {
    return GameState.playerSpecificEvents.includes(event.event);
  }

  private isServerEvent(
    event: ToEventData<GeneralGameEvents>,
  ): event is ToServerEventData<GeneralGameEvents> {
    return GameState.nonPlayerSpecificEvents.includes(event.event);
  }

  private addToEventHistory(
    event: ToEventData<GeneralGameEvents>,
    player?: string,
  ) {
    if (!player) {
      this.players.forEach((x) => {
        this.eventHistory[x.id]?.push(event);
      });
    } else {
      this.eventHistory[player]?.push(event);
    }
  }
}
