import { Temporal } from "temporal-polyfill";
import { type StateCreator } from "zustand";

// #region types

declare global {
  interface KnownTimerNamesMap {
    __testingOnly: string;
  }
}

interface TimerState {
  mutable: {
    timerId: NodeJS.Timeout | null;
    intervalId: NodeJS.Timeout | null;
    remainingTime: Temporal.Duration;
    startTime: Temporal.Instant;

    canceled: boolean;
    completed: boolean;
    formattedTime: string;
    isActive: boolean;
  };
  options:
    | {
        countDirection?: "up-from-0" | "down-from-end";
        shouldUpdateStateEverySecond: false;
      }
    | {
        countDirection: "up-from-0" | "down-from-end";
        shouldUpdateStateEverySecond: true;
      };
  timerName: string;
  /**
   * start or resume the timer
   */
  startOrResume: () => void;
  /**
   * pause the timer
   */
  pause: () => void;
  /**
   * Stops the timer and does not allow to restart it
   */
  cancel: () => void;
  /**
   * Resets the timer into its original state
   */
  reset: () => void;
}

export type KnownTimerNames = keyof KnownTimerNamesMap;
export type TimerSlice<Property extends KnownTimerNames> = Record<
  Property,
  TimerState
>;

// #endregion

/**
 * Use this function to add a timer to a store.
 * @param timerName
 * @param duration
 * @param options
 * @returns
 */
export function createTimerSlice<TimerName extends KnownTimerNames>(
  timerName: TimerName,
  duration: Temporal.Duration,
  options: TimerState["options"],
): StateCreator<Record<TimerName, TimerState>> {
  return function timerSlice(originalSet, originalGet) {
    // provide abstractions for the get and set function to make it more convenient to use
    const get = function getTimerSlice() {
      return originalGet()[timerName];
    };

    const set = function setTimerSlice(
      mutation: Partial<TimerState["mutable"]>,
    ) {
      originalSet(
        (state) =>
          ({
            [timerName]: {
              ...state[timerName],
              mutable: Object.assign(state[timerName].mutable, mutation),
            } satisfies TimerState,
          }) as Record<TimerName, TimerState>,
      );
    };

    const defaultMutation = {
      timerId: null,
      intervalId: null,
      startTime: Temporal.Now.instant(),
      canceled: false,
      completed: false,
      remainingTime: duration.round({
        largestUnit: "hours",
        smallestUnit: "second",
      }),
      formattedTime: "--:--",
      isActive: false,
    } satisfies TimerState["mutable"];

    return {
      [timerName]: {
        mutable: { ...defaultMutation },
        timerName: timerName as string,
        options,

        startOrResume: () => {
          const { timerId, remainingTime, canceled } = get().mutable;
          if (timerId !== null || canceled) return;

          const milliseconds = durationToMilliseconds(remainingTime);
          const newTimerId = setTimeout(() => {
            set({ timerId: null, completed: true });
          }, milliseconds);

          set({
            timerId: newTimerId,
            isActive: true,
            startTime: Temporal.Now.instant(),
          });

          // only provide a formatted time, if configured in the options
          if (options.shouldUpdateStateEverySecond === false) return;

          // as the timer could be resumed at any point in time, there can be a drift
          // between when a second is over and when the interval second is over.
          // to counter this effect, an initial delay is added to wait until a full second
          // is over and then the interval is started
          const initialDelay = milliseconds % 1000;
          const intervalFunc = () => {
            const newIntervalId = setInterval(() => {
              const currentRemaining = get().mutable.remainingTime.subtract({
                seconds: 1,
              });
              set({
                remainingTime: currentRemaining,
                formattedTime: formatTime(currentRemaining),
              });
            }, 1000);

            set({
              intervalId: newIntervalId,
            });
          };

          if (initialDelay === 0) {
            intervalFunc();
            set({ formattedTime: formatTime(remainingTime) });
          } else {
            const initialDelayTimeoutId = setTimeout(() => {
              intervalFunc();
              const { startTime, remainingTime } = get().mutable;
              const endTime = startTime.add(remainingTime);
              const newRemainingTime = endTime.since(Temporal.Now.instant());

              set({
                remainingTime: newRemainingTime,
                formattedTime: formatTime(newRemainingTime),
              });
            }, initialDelay);

            set({
              intervalId: initialDelayTimeoutId,
              formattedTime: formatTime(remainingTime),
            });
          }
        },

        pause: () => {
          const { timerId, intervalId, remainingTime, canceled, startTime } =
            get().mutable;
          if (timerId === null || canceled) return;

          clearTimeout(timerId);
          if (intervalId !== null) clearTimeout(intervalId);

          const endTime = startTime.add(remainingTime);
          const newRemainingTime = endTime.since(Temporal.Now.instant());

          set({
            timerId: null,
            intervalId: null,
            remainingTime: newRemainingTime,
            isActive: false,
          });
        },

        cancel: () => {
          const { timerId, intervalId, canceled } = get().mutable;
          if (canceled) return;

          if (timerId !== null) clearTimeout(timerId);
          if (intervalId !== null) clearTimeout(intervalId);

          set({
            timerId: null,
            intervalId: null,
            canceled: true,
            isActive: false,
          });
        },

        reset: () => {
          get().cancel();
          set({ ...defaultMutation });
        },
      } satisfies TimerState,
    } as Record<TimerName, TimerState>;
  };
}

// #region helper functions

function durationToMilliseconds(duration: Temporal.Duration): number {
  return duration.total({ unit: "milliseconds" });
}

function formatTime(duration: Temporal.Duration) {
  const roundedDuration = duration.round({
    smallestUnit: "second",
    roundingMode: "expand",
  });
  return Temporal.PlainTime.from({
    hour: roundedDuration.hours,
    minute: roundedDuration.minutes,
    second: roundedDuration.seconds,
  }).toLocaleString("default", {
    minute: "2-digit",
    second: "2-digit",
  });
}

// #endregion
