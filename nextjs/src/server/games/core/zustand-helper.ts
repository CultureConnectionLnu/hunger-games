import { Mutate, StoreApi, UseBoundStore } from "zustand";

export type SubscribeStore<T> = UseBoundStore<
  Mutate<StoreApi<T>, [["zustand/subscribeWithSelector", never]]>
>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<any>
    ? T[P]
    : T[P] extends object
      ? DeepPartial<T[P]>
      : T[P];
} & {};
