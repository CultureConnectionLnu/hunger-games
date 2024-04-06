"use client";
import React, { createContext, useContext, useState } from "react";

type Timer = {
  id: string;
  secondsLeft: number;
  label: string;
};

export type TimerCtxData = {
  timers: Timer[];
  updateTimer: (id: string, secondsLeft: number, label: string) => void;
};

type TimerCtx =
  | ({ isLoading: true } & Partial<TimerCtxData>)
  | ({ isLoading: false } & TimerCtxData);

// Timer context
const TimerContext = createContext<TimerCtx>({ isLoading: true });

export const useTimers = () => useContext(TimerContext);

// Timer provider component
export default function TimerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [timers, setTimers] = useState<Timer[]>([]);

  const updateTimer = (id: string, secondsLeft: number, label: string) => {
    if (timers.some((timer) => timer.id === id) === false) {
      setTimers((prevTimers) => [
        ...prevTimers,
        { id: id, secondsLeft, label },
      ]);
      return;
    }
    setTimers((prevTimers) =>
      prevTimers
        .map((timer) => {
          if (timer.id === id) {
            if (secondsLeft <= 0) return undefined;
            return { ...timer, secondsLeft };
          }
          return timer;
        })
        .filter(Boolean),
    );
  };

  return (
    <TimerContext.Provider value={{ timers, updateTimer, isLoading: false }}>
      {children}
    </TimerContext.Provider>
  );
}
