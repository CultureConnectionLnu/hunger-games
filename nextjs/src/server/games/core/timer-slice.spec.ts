import { Temporal } from "temporal-polyfill";
import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { createStore } from "zustand";
import { createTimerSlice, TimerSlice } from "./timer-slice";

describe("timer slice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime("2023-01-01T00:00:00.000Z");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('ensure fake timer works with "vi.advanceTimersByTimeAsync"', async () => {
    const endTime = Temporal.Now.instant().add({ seconds: 1 });
    await vi.advanceTimersByTimeAsync(500);
    expect(endTime.since(Temporal.Now.instant()).milliseconds).toBe(500);
    await vi.advanceTimersByTimeAsync(500);
    expect(endTime.since(Temporal.Now.instant()).milliseconds).toBe(0);
  });

  describe("isActive", () => {
    test("by default, should not start the timer", async () => {
      const { getState } = testSetup();
      expect(getState().mutable.isActive).toBe(false);
    });

    test("should start the timer", async () => {
      const { getState } = testSetup();
      getState().startOrResume();
      expect(getState().mutable.isActive).toBe(true);
    });

    test("should pause the timer", async () => {
      const { getState } = testSetup();
      getState().startOrResume();
      getState().pause();
      expect(getState().mutable.isActive).toBe(false);
    });

    test("should cancel the timer", async () => {
      const { getState } = testSetup();
      getState().startOrResume();
      getState().cancel();
      expect(getState().mutable.isActive).toBe(false);
    });

    test("when the timer is canceled, should not start the timer again", async () => {
      const { getState } = testSetup();
      getState().startOrResume();
      getState().cancel();
      getState().startOrResume();

      // the timer should not be started again
      expect(getState().mutable.isActive).toBe(false);
    });
  });

  describe("completed", () => {
    test("should mark as completed when timer runs out", async () => {
      const { getState } = testSetup({
        duration: Temporal.Duration.from({ seconds: 1 }),
      });
      getState().startOrResume();

      await vi.advanceTimersByTimeAsync(1000);

      expect(getState().mutable.completed).toBe(true);
    });

    test("should not mark as completed when the timer is paused", async () => {
      const { getState } = testSetup({
        duration: Temporal.Duration.from({ seconds: 1 }),
      });
      getState().startOrResume();

      await vi.advanceTimersByTimeAsync(500);
      getState().pause();

      await vi.advanceTimersByTimeAsync(500);

      expect(getState().mutable.completed).toBe(false);
    });

    test("should mark as completed upon resuming the timer", async () => {
      const { getState } = testSetup({
        duration: Temporal.Duration.from({ seconds: 1 }),
      });
      getState().startOrResume();

      await vi.advanceTimersByTimeAsync(500);
      getState().pause();
      await vi.advanceTimersByTimeAsync(500);
      getState().startOrResume();
      await vi.advanceTimersByTimeAsync(500);

      expect(getState().mutable.completed).toBe(true);
    });
  });

  describe("canceled", () => {
    test("by default, should not be canceled", async () => {
      const { getState } = testSetup();
      expect(getState().mutable.canceled).toBe(false);
    });

    test("should cancel the timer", async () => {
      const { getState } = testSetup();
      getState().startOrResume();
      getState().cancel();
      expect(getState().mutable.canceled).toBe(true);
    });
  });

  describe("formattedTime", () => {
    test("by default, show no value", async () => {
      const { getState } = testSetup({
        options: {
          shouldUpdateStateEverySecond: false,
        },
      });
      getState().startOrResume();

      expect(getState().mutable.formattedTime).toBe("--:--");
    });

    describe("down-from-end", () => {
      test("provide formatted time value", async () => {
        const { getState } = testSetup({
          duration: Temporal.Duration.from({ seconds: 10 }),
          options: {
            shouldUpdateStateEverySecond: true,
            countDirection: "down-from-end",
          },
        });

        getState().startOrResume();

        expect(getState().mutable.formattedTime).toBe("00:10");
      });

      test("should update the formatted time every second", async () => {
        const { getState } = testSetup({
          duration: Temporal.Duration.from({ seconds: 5 }),
          options: {
            shouldUpdateStateEverySecond: true,
            countDirection: "down-from-end",
          },
        });
        getState().startOrResume();
        await vi.advanceTimersByTimeAsync(1000);
        expect(getState().mutable.formattedTime).toBe("00:04");
        await vi.advanceTimersByTimeAsync(1000);
        expect(getState().mutable.formattedTime).toBe("00:03");
        await vi.advanceTimersByTimeAsync(1000);
        expect(getState().mutable.formattedTime).toBe("00:02");
        await vi.advanceTimersByTimeAsync(1000);
        expect(getState().mutable.formattedTime).toBe("00:01");
        await vi.advanceTimersByTimeAsync(1000);
        expect(getState().mutable.formattedTime).toBe("00:00");

        expect(getState().mutable.completed).toBe(true);
      });

      test("should not update the formatted time if a second is not over yet", async () => {
        const { getState } = testSetup({
          duration: Temporal.Duration.from({ seconds: 5 }),
          options: {
            shouldUpdateStateEverySecond: true,
            countDirection: "down-from-end",
          },
        });
        getState().startOrResume();
        await vi.advanceTimersByTimeAsync(500);

        expect(getState().mutable.formattedTime).toBe("00:05");
      });

      test("pausing the timer also stops the formatted time from updating", async () => {
        const { getState } = testSetup({
          duration: Temporal.Duration.from({ seconds: 5 }),
          options: {
            shouldUpdateStateEverySecond: true,
            countDirection: "down-from-end",
          },
        });
        getState().startOrResume();
        await vi.advanceTimersByTimeAsync(1000);
        expect(getState().mutable.formattedTime).toBe("00:04");
        getState().pause();
        await vi.advanceTimersByTimeAsync(1000);
        expect(getState().mutable.formattedTime).toBe("00:04");
      });

      test("after pausing, the formatted time is only updated once a full second passed", async () => {
        const { getState } = testSetup({
          duration: Temporal.Duration.from({ seconds: 5 }),
          options: {
            shouldUpdateStateEverySecond: true,
            countDirection: "down-from-end",
          },
        });
        getState().startOrResume();
        await vi.advanceTimersByTimeAsync(900);
        getState().pause();
        expect(getState().mutable.formattedTime).toBe("00:05");
        await vi.advanceTimersByTimeAsync(2000);

        getState().startOrResume();
        expect(getState().mutable.formattedTime).toBe("00:05");

        await vi.advanceTimersByTimeAsync(100);
        expect(getState().mutable.formattedTime).toBe("00:04");
        await vi.advanceTimersByTimeAsync(1000);
        expect(getState().mutable.formattedTime).toBe("00:03");
      });
    });

    describe("up-from-0", () => {
      test("option is ignored as of now, not implemented", async () => {
        const { getState } = testSetup({
          duration: Temporal.Duration.from({ seconds: 5 }),
          options: {
            shouldUpdateStateEverySecond: true,
            countDirection: "up-from-0",
          },
        });
        getState().startOrResume();

        expect(getState().mutable.formattedTime).toBe("00:05");
      });
    });
  });
});

function testSetup({
  duration,
  options,
}: {
  duration?: Temporal.Duration;
  options?: Parameters<typeof createTimerSlice>[2];
} = {}) {
  const store = createStore<TimerSlice<"__testingOnly">>((...a) => ({
    ...createTimerSlice(
      "__testingOnly",
      duration ?? Temporal.Duration.from({ seconds: 10 }),
      options ?? {
        shouldUpdateStateEverySecond: false,
      },
    )(...a),
  }));

  const getState = () => {
    return store.getState().__testingOnly;
  };

  return { getState };
}
