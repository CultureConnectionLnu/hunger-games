"use client";
import React, { createContext, useContext, useState } from "react";
import type { TimerEvent } from "~/server/api/logic/core/timer";

type Timer = {
  id: string;
  secondsLeft: number;
  paused: boolean;
  label: string;
};

export type TimerCtxData = {
  timers: Map<string, Timer>;
  handleEvent: (id: string, event: TimerEvent, label: string) => void;
};

const TimerContext = createContext<TimerCtxData>({
  timers: new Map(),
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  handleEvent: () => {},
});

export const useTimers = () => useContext(TimerContext);

// Timer provider component
export default function TimerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [timers, setTimers] = useState<Map<string, Timer>>(new Map());

  const addTimer = (id: string, secondsLeft: number, label: string) => {
    setTimers(
      (current) =>
        new Map(current.set(id, { id, secondsLeft, label, paused: false })),
    );
  };

  const removeTimer = (id: string) => {
    setTimers((current) => {
      current.delete(id);
      return new Map(current);
    });
  };

  const updateTimer = (id: string, secondsLeft: number, running: boolean) => {
    setTimers((current) => {
      const timer = current.get(id);
      if (timer) {
        current.set(id, { ...timer, secondsLeft, paused: !running });
      }
      return new Map(current);
    });
  };

  const handleEvent = (id: string, event: TimerEvent, label: string) => {
    switch (event.type) {
      case "start":
        return addTimer(id, event.secondsLeft, label);
      case "end":
        return removeTimer(id);
      case "update":
      case "pause":
      case "resume":
        return updateTimer(id, event.secondsLeft, event.running);
    }
    event satisfies never;
  };

  return (
    <TimerContext.Provider value={{ timers, handleEvent }}>
      {children}
    </TimerContext.Provider>
  );
}
