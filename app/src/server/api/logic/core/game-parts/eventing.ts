/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { BaseEvent, GenericEventEmitter } from "~/lib/event-emitter";
import type { OnlyPlayerEvents, UnspecificPlayerEventData } from "../types";

type Input = Readonly<{
  emit: GenericEventEmitter<BaseEvent>["emit"];
  fightId: string;
  playerIds: string[];
  getView: (playerId: string) => string;
  playerSpecificEvents: string[];
  serverSpecificEvents: string[];
}>;

export class GameEventingHandler<T extends BaseEvent> {
  private readonly eventHistory: Record<string, OnlyPlayerEvents<T>[]> = {};

  constructor(private readonly input: Input) {
    this.input.playerIds.forEach((playerId) => {
      this.eventHistory[playerId] = [];
    });
  }

  public getPlayerEvents(playerId: string) {
    return [...(this.eventHistory[playerId] ?? [])];
  }

  emitEvent(eventData: any, playerId?: string): void {
    /**
     * Overloading the function is the only way to type it correctly for both the current class
     * and its children.
     *
     * This entire class is not type safe and uses any a lot.
     * Because one of the generics is not known at this point, it's impossible to type it correctly.
     */

    if (this.isServerEvent(eventData)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { event, ...data } = eventData;
      const serverEvent = {
        ...data,
        fightId: this.input.fightId,
      };
      this.input.emit(eventData.event, serverEvent);
    }

    if (this.isPlayerEvent(eventData)) {
      if (playerId) {
        this.emitPlayerEvent(eventData, playerId);
      } else {
        this.input.playerIds.forEach((player) =>
          this.emitPlayerEvent(eventData, player),
        );
      }
    }
  }

  private emitPlayerEvent(eventData: any, playerId: string) {
    const event = {
      event: eventData.event,
      data: eventData.data,
      fightId: this.input.fightId,
      view: this.input.getView(playerId),
    } satisfies UnspecificPlayerEventData;
    this.addToEventHistory(event, playerId);
    this.input.emit(`player-${playerId}`, event);
  }

  private addToEventHistory(event: any, player: string) {
    this.eventHistory[player]?.push(event);
  }

  private isPlayerEvent(event: { event: string }) {
    return this.input.playerSpecificEvents.includes(event.event);
  }

  private isServerEvent(event: { event: string }) {
    return this.input.serverSpecificEvents.includes(event.event);
  }
}
