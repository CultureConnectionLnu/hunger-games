import type { GenericEventEmitter } from "~/lib/event-emitter";
import type {
  ToEventData,
  ToPlayerEventData,
  ToServerEventData,
} from "./types";
import type { PlayerState } from "./player-state";

export function emitEventFactory<Events, Player extends PlayerState>(setup: {
  emitter: GenericEventEmitter<Events>;
  playerSpecificEvents: string[];
  serverSpecificEvents: string[];
  fightId: string;
  players: Map<string, Player>;
  addToEventHistory: (event: ToEventData<Events>, player?: string) => void;
}) {
  function isPlayerEvent(
    event: ToEventData<Events>,
  ): event is ToPlayerEventData<Events> {
    return setup.playerSpecificEvents.includes(event.event as string);
  }

  function isServerEvent(
    event: ToEventData<Events>,
  ): event is ToServerEventData<Events> {
    return setup.serverSpecificEvents.includes(event.event as string);
  }

  return function (event: ToEventData<Events>, player?: string) {
    if (isServerEvent(event)) {
      setup.addToEventHistory(event);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      setup.emitter.emit(event.event, {
        data: event.data,
        fightId: setup.fightId,
      });
      return;
    }

    if (isPlayerEvent(event)) {
      setup.addToEventHistory(event, player);
      if (player) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        setup.emitter.emit(`player-${player}`, {
          ...event,
          fightId: setup.fightId,
          state: setup.players.get(player)!.state,
        });
      } else {
        setup.players.forEach((x) =>
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          setup.emitter.emit(`player-${x.id}`, {
            ...event,
            fightId: setup.fightId,
            state: x.state,
          }),
        );
      }
    }
  };
}
