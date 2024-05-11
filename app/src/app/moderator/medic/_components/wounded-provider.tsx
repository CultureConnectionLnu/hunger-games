/* eslint-disable @typescript-eslint/no-empty-function */
"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type WoundedPlayer = UnwrapArray<RouterOutputs["medic"]["getAllWounded"]>;

export type WoundedCtxData = {
  woundedPlayers: WoundedPlayer[];
  isLoading: boolean;
};

const WoundedContext = createContext<WoundedCtxData>({
  woundedPlayers: [],
  isLoading: true,
});

export function WoundedProvider({ children }: { children: React.ReactNode }) {
  const [initialLoading, setInitialLoading] = useState(true);
  const { data, isLoading } = api.medic.getAllWounded.useQuery();

  useEffect(() => {
    if (!initialLoading) return;
    if (!isLoading) setInitialLoading(false);
  }, [initialLoading, setInitialLoading, isLoading]);

  return (
    <WoundedContext.Provider
      value={{ woundedPlayers: data ?? [], isLoading: initialLoading }}
    >
      {children}
    </WoundedContext.Provider>
  );
}

export function useWoundedPlayer() {
  const context = useContext(WoundedContext);
  if (context === undefined) {
    throw new Error("useWoundedPlayer must be used within a WoundedProvider");
  }
  return context;
}
