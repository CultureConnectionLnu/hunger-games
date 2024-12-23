import { StateCreator } from "zustand";
import { Temporal } from "temporal-polyfill";

declare global {
  interface KnownTimerNames {
    // todo: move these timers to player connection state slice
    startTimeout: string;
    player1DisconnectedLoose: string;
    player2DisconnectedLoose: string;
    forceStopGame: string;
  }
}

interface TimerState {
  mutable: {
    timerId: NodeJS.Timeout | null;
    intervalId: NodeJS.Timeout | null;
    remainingTime: Temporal.Duration;
    canceled: boolean;

    formattedTime: string;
    isActive: boolean;
  };
  options: {
    countDirection: "up" | "down";
    shouldUpdateStateEverySecond: boolean;
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

export function createTimerSlice<TimerName extends keyof KnownTimerNames>(
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
      canceled: false,
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
            set({ timerId: null });
          }, milliseconds);

          set({ timerId: newTimerId, isActive: true });

          // only provide a formatted time, if configured in the options
          if (options.shouldUpdateStateEverySecond === false) return;

          // as the timer could be resumed at any point in time, there can be a drift
          // between when a second is over and when the interval second is over.
          // to counter this effect, an initial delay is added to wait until a full second
          // is over and then the interval is started
          const initialDelay = milliseconds % 1000;
          const initialDelayTimeoutId = setTimeout(() => {
            const newIntervalId = setInterval(() => {
              const currentRemaining = get().mutable.remainingTime.subtract({
                seconds: 1,
              });
              set({
                remainingTime: currentRemaining,
                formattedTime: formatTime(currentRemaining),
              });
            }, 1000);
            set({ intervalId: newIntervalId });
          }, initialDelay);

          set({ intervalId: initialDelayTimeoutId });
        },

        pause: () => {
          const { timerId, intervalId, remainingTime, canceled } =
            get().mutable;
          if (timerId === null || canceled) return;

          clearTimeout(timerId);
          if (intervalId !== null) clearTimeout(intervalId);

          const endTime = Temporal.Now.instant().add(remainingTime);
          const now = Temporal.Now.instant();
          const newRemainingTime = endTime.since(now);

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

function durationToMilliseconds(duration: Temporal.Duration): number {
  return duration.total({ unit: "milliseconds" });
}

function formatTime(duration: Temporal.Duration) {
  return Temporal.PlainTime.from({
    hour: duration.hours,
    minute: duration.minutes,
    second: duration.seconds,
  }).toLocaleString("default", {
    minute: "2-digit",
    second: "2-digit",
  });
}
