/* eslint-disable @typescript-eslint/no-empty-function */
"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

export type CountdownCtxData = {
  registerCountdown: (id: string, initialSeconds: number) => void;
  registerOnlyNewCountdown: (
    config: { id: string; initialSeconds: number }[],
  ) => void;
  countdowns: Record<string, number>;
};

const CountdownContext = createContext<CountdownCtxData>({
  registerCountdown: () => {},
  registerOnlyNewCountdown: () => {},
  countdowns: {},
});

export function CountdownProvider({ children }: { children: React.ReactNode }) {
  const [countdowns, setCountdowns] = useState<Record<string, number>>({});

  const registerCountdown = (id: string, initialSeconds: number) => {
    setCountdowns((prev) => ({
      ...prev,
      [id]: initialSeconds,
    }));
  };

  const registerOnlyNewCountdown = (
    config: { id: string; initialSeconds: number }[],
  ) => {
    const existingCountdowns = Object.keys(countdowns);
    const newCountdowns = config
      .filter((x) => !existingCountdowns.includes(x.id))
      .reduce(
        (acc, x) => {
          /**
           * In case that the page is reloaded and the countdown is already past the actual time then this would be a negative number.
           */
          acc[x.id] = Math.max(x.initialSeconds, 0);
          return acc;
        },
        {} as typeof countdowns,
      );
    if (Object.keys(newCountdowns).length === 0) return;
    setCountdowns((prev) => ({
      ...prev,
      ...newCountdowns,
    }));
  };

  useEffect(() => {
    const intervalId = setInterval(() => {
      setCountdowns((currentCountdowns) => {
        const updatedCountdowns = {} as typeof countdowns;
        Object.keys(currentCountdowns).forEach((key) => {
          if (currentCountdowns[key] === 0) {
            // ensure that entries are deleted when they reach 0 (but one second later, so that the hook can set the `isDone` value)
            return;
          }

          if (currentCountdowns[key]! > 0) {
            updatedCountdowns[key] = currentCountdowns[key]! - 1;
          } else {
            updatedCountdowns[key] = 0;
          }
        });
        return updatedCountdowns;
      });
    }, 1000);
    return () => clearInterval(intervalId);
  }, [setCountdowns]);

  return (
    <CountdownContext.Provider
      value={{ countdowns, registerCountdown, registerOnlyNewCountdown }}
    >
      {children}
    </CountdownContext.Provider>
  );
}

export function useCountdownConfig() {
  const context = useContext(CountdownContext);
  if (context === undefined) {
    throw new Error("useCountdown must be used within a CountdownProvider");
  }
  return {
    registerCountdown: context.registerCountdown,
    registerOnlyNewCountdown: context.registerOnlyNewCountdown,
  };
}

export function useCountdown(id: string) {
  const [isDone, setIsDone] = useState(false);
  const context = useContext(CountdownContext);
  if (context === undefined) {
    throw new Error("useCountdown must be used within a CountdownProvider");
  }

  const seconds = context.countdowns[id];
  useEffect(() => {
    if (seconds === 0) {
      setIsDone(true);
    }
  }, [seconds, setIsDone]);

  return {
    seconds,
    isDone,
  };
}
