import { type Temporal } from "temporal-polyfill";
import { type Mutate, type StoreApi, type UseBoundStore } from "zustand";

export type SubscribeStore<T> = UseBoundStore<
  Mutate<StoreApi<T>, [["zustand/subscribeWithSelector", never]]>
>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<unknown>
    ? T[P]
    : T[P] extends Temporal.Duration
      ? T[P]
      : T[P] extends object
        ? DeepPartial<T[P]>
        : T[P];
} & {};
