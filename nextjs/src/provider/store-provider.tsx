"use client";
import { useAuth } from "@clerk/nextjs";
import React, { createContext, useContext, useEffect, useState } from "react";
import { createStore, useStore as zustandUseStore } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { createGameSlice } from "./store/game-slice";
import { createTimerSlice } from "./store/timer-slice";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ClientStore {}

  type ClientStoreInstance = ReturnType<typeof createStore<ClientStore>>;
}

type StoreInstance = ReturnType<typeof storeFactory>;

type StoreProviderProps = {
  store?: StoreInstance;
};

function storeFactory(isSignedIn: () => boolean, wsUrl?: string) {
  const store = createStore<ClientStore>()(
    subscribeWithSelector((...a) => ({
      game: createGameSlice(isSignedIn, wsUrl)(...a),
      timer: createTimerSlice()(...a),
    })),
  );
  return store;
}

const StoreContext = createContext<StoreProviderProps>({});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth();
  const [store, setStore] = useState<StoreInstance | undefined>(undefined);

  useEffect(() => {
    if (!isSignedIn) {
      setStore(undefined);
      return;
    }
    setStore(storeFactory(() => isSignedIn));

    return () => {
      store?.getState().game.cleanup();
    };

    // explicitly ignore the 'getToken' dependency, as it will always provide the current token, even if its not the same instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn]);

  return (
    <StoreContext.Provider value={{ store }}>{children}</StoreContext.Provider>
  );
}

export function useStoreReady() {
  const { store } = useContext(StoreContext);
  return store !== undefined;
}

export function useStore<T>(selector: (state: ClientStore) => T): T {
  const { store } = useContext(StoreContext);
  if (store === undefined) {
    throw new Error(
      "You can only use the store on pages where the user is logged in",
    );
  }
  return zustandUseStore(store, selector);
}

export function StoreReadyLoading({ children }: { children: React.ReactNode }) {
  const storeReady = useStoreReady();
  if (storeReady === false) {
    return <div>Loading...</div>;
  }
  return <>{children}</>;
}
