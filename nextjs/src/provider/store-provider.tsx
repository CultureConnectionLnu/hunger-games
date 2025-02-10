"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { createGameSlice, type GameSlice } from "./store/game-slice";
import { createStore, useStore as zustandUseStore } from "zustand";
import { useAuth } from "@clerk/nextjs";
type Store = GameSlice;
type StoreInstance = ReturnType<typeof storeFactory>;

type StoreProviderProps = {
  store?: StoreInstance;
};

function storeFactory(isSignedIn: () => boolean, wsUrl?: string) {
  const store = createStore<Store>()((...a) => ({
    ...createGameSlice(isSignedIn, wsUrl)(...a),
  }));
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

export function useStore<T>(selector: (state: Store) => T): T {
  const { store } = useContext(StoreContext);
  if (store === undefined) {
    throw new Error(
      "You can only use the store on pages where the user is logged in",
    );
  }
  return zustandUseStore(store, selector);
}
