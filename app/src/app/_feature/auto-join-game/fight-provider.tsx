"use client";

import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import React, { useContext } from "react";
import { createContext, useState } from "react";
import { api } from "~/trpc/react";

export type FightContext = {
  currentFight: { id: string; game: string } | undefined;
};

const FightContext = createContext<FightContext>({ currentFight: undefined });
export const useFight = () => useContext(FightContext);

export default function FightProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [currentFight, setCurrentFight] =
    useState<FightContext["currentFight"]>();
  const router = useRouter();
  const { user } = useUser();

  const autoJoinGame = () => router.push(`/game`);
  const showGameResult = () =>
    router.push(`/history?fightId=${currentFight?.id}`);

  api.fight.onFightUpdate.useSubscription(
    { id: user?.id ?? "" },
    {
      onData(event) {
        switch (event.type) {
          case "join":
            setCurrentFight({ id: event.fightId, game: event.game });
            autoJoinGame();
            break;
          case "end":
            showGameResult();
            setCurrentFight(undefined);
            break;
        }
      },
      enabled: Boolean(user?.id),
    },
  );

  return (
    <FightContext.Provider value={{ currentFight }}>
      {children}
    </FightContext.Provider>
  );
}
