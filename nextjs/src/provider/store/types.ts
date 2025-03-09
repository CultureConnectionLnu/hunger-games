import type { StateCreator } from "zustand";

type StoreSlice<T> = StateCreator<
  ClientStore,
  [["zustand/subscribeWithSelector", never]],
  [],
  T
>;

export function createSlice<T>(slice: StoreSlice<T>): StoreSlice<T> {
  return slice;
}
