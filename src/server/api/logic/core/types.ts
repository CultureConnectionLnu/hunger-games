import type { TimerEvent } from "./timeout-counter";
import type { CombineIfNotNever, IfNotNever, ToUnion } from "./util";

/**
 * create typed events for the game
 */
export type EventTemplate<
  Events extends Record<string, unknown>,
  PlayerStates extends string,
  ServerEvents extends keyof Events = never,
  PlayerEvents extends keyof Events = keyof Events,
> = CombineIfNotNever<
  IfNotNever<
    PlayerEvents,
    CreatePlayerEvent<Pick<Events, PlayerEvents>, PlayerStates>,
    never
  >,
  IfNotNever<ServerEvents, CreateServerEvent<Pick<Events, ServerEvents>>, never>
>;

/**
 * get only the data that should be passed into the internal emit event function
 */
export type ToEventData<T> = ToPlayerEventData<T> | ToServerEventData<T>;
export type ToPlayerEventData<T> = ReduceToEvent<ToUnion<PlayerEventsOnly<T>>>;
export type ToServerEventData<T> = ToUnion<
  ReduceToEventAndData<ServerEventsOnly<T>>
>;

export type OnlyPlayerEvents<T> = ToUnion<PlayerEventsOnly<T>>;

export type GetTimerEvents<T> = ToUnion<{
  [Key in keyof T as FilterForTimeEvents<T[Key]> extends never
    ? never
    : Key]: FilterForTimeEvents<T[Key]>;
}>;

type FilterForTimeEvents<T> = T extends { data: TimerEvent; event: infer Event }
  ? Event
  : never;

type CreateServerEvent<T> = {
  [Key in keyof T]: {
    data: T[Key];
    fightId: string;
  };
};

type CreatePlayerEvent<T, States> = {
  [Key in keyof T as `player-${string}`]: {
    event: Key;
    data: T[Key];
    fightId: string;
    state: States;
  };
};

type ReduceToEventAndData<T> = {
  [Key in keyof T]: T[Key] extends { data: infer Data }
    ? {
        event: Key;
        data: Data;
      }
    : never;
};
type ReduceToEvent<T> = T extends {
  event: infer Event;
  data: infer Data;
}
  ? {
      event: Event;
      data: Data;
    }
  : never;

type PlayerEventsOnly<T> = {
  [Key in keyof T as Key extends `player-${string}` ? Key : never]: T[Key];
};
type ServerEventsOnly<T> = {
  [Key in keyof T as Key extends `player-${string}` ? never : Key]: T[Key];
};
