import { Mutate, StoreApi, UseBoundStore } from "zustand";

export type SubscribeStore<T> = UseBoundStore<
  Mutate<StoreApi<T>, [["zustand/subscribeWithSelector", never]]>
>;
