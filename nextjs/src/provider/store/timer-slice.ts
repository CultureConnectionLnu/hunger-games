import { createSlice } from "./types";

declare global {
  interface ClientStore {
    timer: TimerSlice;
  }
}

export type TimerSlice = {
  visible: {
    name: string;
    formattedTime: string;
  }[];
  all: Timers;
};

type Timers = Record<
  string,
  | {
      visible: boolean;
      formattedTime: string;
    }
  | undefined
>;

export function createTimerSlice() {
  return createSlice<TimerSlice>(function timerSlice(originalSet, get, api) {
    const set = function setTimerSlice(timers?: Timers) {
      if (timers === undefined) return;
      const currentTimers = get().timer;

      const relevantTimerKeys = Object.keys(timers);
      const currentRelevantTimers = relevantTimerKeys.map(
        (timer) => [timer, currentTimers.all[timer]] as const,
      );

      const hasChanged = currentRelevantTimers.some(([name, timer]) => {
        const newTimer = timers[name];
        if (newTimer === undefined && timer === undefined) return false;
        if (newTimer === undefined || timer === undefined) return true;

        return (
          newTimer.visible !== timer.visible ||
          newTimer.formattedTime !== timer.formattedTime
        );
      });

      if (!hasChanged) return;

      const updatedAll = { ...currentTimers.all };

      for (const Key of relevantTimerKeys) {
        updatedAll[Key] = timers[Key];
      }

      const updatedVisible = Object.entries(updatedAll)
        .map(([name, timer]) => {
          if (timer === undefined) return undefined;
          if (timer.visible === false) return undefined;
          return {
            name,
            formattedTime: timer.formattedTime,
          };
        })
        .filter((timer) => timer !== undefined);

      originalSet({
        timer: {
          visible: updatedVisible,
          all: updatedAll,
        },
      });
    };

    api.subscribe((state) => state?.game.mutable.room?.timer, set);
    api.subscribe(
      (state) => state?.game.mutable.gameSpecific?.logic.timer,
      set,
    );
    // cleanup
    api.subscribe(
      (state) => state?.game.mutable.room?.outcome !== undefined,
      (gameEndEvent) => {
        if (gameEndEvent === false) return;
        originalSet({
          timer: {
            visible: [],
            all: {},
          },
        });
      },
    );

    return {
      visible: [],
      all: {},
    };
  });
}
