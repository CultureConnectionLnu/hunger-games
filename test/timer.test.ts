import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TimerFactory, type TimerEvent } from "~/server/api/logic/core/timer";

describe("Timer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('should emit "start" event when timer is created', async () => {
    const { getLastEvent } = await setupTimer(10);

    expect(getLastEvent()).toEqual({
      type: "start",
      secondsLeft: 10,
      running: true,
    });
  });

  it('should emit "update" event after one second', async () => {
    const { getLastEvent, passTimeInSeconds } = await setupTimer(10);

    await passTimeInSeconds(1);

    expect(getLastEvent()).toEqual({
      type: "update",
      secondsLeft: 9,
      running: true,
    });
  });

  it('should emit "update" event one time less in total than seconds', async () => {
    const { getAllEventsOfType, passTimeInSeconds } = await setupTimer(10);

    await passTimeInSeconds(10);

    expect(getAllEventsOfType("update")).toHaveLength(9);
  });

  it('should emit "end" event after total time passed', async () => {
    const { getLastEvent, passTimeInSeconds } = await setupTimer(10);

    await passTimeInSeconds(10);

    expect(getLastEvent()).toEqual({
      type: "end",
      secondsLeft: 0,
      running: true,
    });
  });

  it("should not emit any more events after total time passed", async () => {
    const { listener, getLastEvent, passTimeInSeconds } = await setupTimer(10);

    await passTimeInSeconds(10);
    listener.mockReset();
    await passTimeInSeconds(10);

    expect(() => getLastEvent()).toThrow();
  });

  it("should emit as many events as total time +1", async () => {
    const { listener, passTimeInSeconds } = await setupTimer(10);

    await passTimeInSeconds(10);

    // as it counts down including 0, so the number of events is "n + 1"
    expect(listener.mock.calls).toHaveLength(11);
  });

  describe("Pause and Resume", () => {
    it('should emit "pause" event', async () => {
      const { timer, getLastEvent } = await setupTimer(10);

      timer.pause();

      expect(getLastEvent()).toEqual({
        type: "pause",
        secondsLeft: 10,
        running: false,
      });
    });

    it("should not emit further events while being paused", async () => {
      const { timer, getLastEvent, passTimeInSeconds } = await setupTimer(10);
      timer.pause();

      await passTimeInSeconds(1);

      expect(getLastEvent()).toEqual({
        type: "pause",
        secondsLeft: 10,
        running: false,
      });
    });

    it("should emit resume event", async () => {
      const { timer, getLastEvent, passTimeInSeconds } = await setupTimer(10);
      timer.pause();
      await passTimeInSeconds(1);

      timer.resume();

      expect(getLastEvent()).toEqual({
        type: "resume",
        secondsLeft: 10,
        running: true,
      });
    });

    it("should restart running events after ", async () => {
      const { timer, getLastEvent, passTimeInSeconds } = await setupTimer(10);
      timer.pause();
      await passTimeInSeconds(1);
      timer.resume();

      await passTimeInSeconds(1);

      expect(getLastEvent()).toEqual({
        type: "update",
        secondsLeft: 9,
        running: true,
      });
    });

    it("should continue normally after a pause and resume till the end", async () => {
      const { timer, getLastEvent, passTimeInSeconds } = await setupTimer(10);

      await passTimeInSeconds(5);
      timer.pause();
      await passTimeInSeconds(5);
      timer.resume();
      await passTimeInSeconds(5);

      expect(getLastEvent()).toEqual({
        type: "end",
        secondsLeft: 0,
        running: true,
      });
    });
  });

  describe("Cancel", () => {
    it("should stop execution immediately upon cancelling", async () => {
      const { timer, getLastEvent } = await setupTimer(10);

      timer.cancel();

      expect(getLastEvent()).toEqual({
        type: "end",
        secondsLeft: 0,
        running: true,
      });
    });

    it("should not emit further events after a cancel", async () => {
      const { timer, getLastEvent, listener, passTimeInSeconds } =
        await setupTimer(10);

      timer.cancel();
      listener.mockReset();
      await passTimeInSeconds(10);

      expect(() => getLastEvent()).toThrow();
    });
  });
});

async function setupTimer(time: number) {
  const timer = TimerFactory.instance.create(time, "test");
  const listener = vi.fn<[TimerEvent], void>();
  timer.on("timer", listener);

  const getLastEvent = () => {
    const lastEventCall = listener.mock.calls[listener.mock.calls.length - 1];
    if (!lastEventCall) {
      throw new Error("No event was emitted");
    }
    return lastEventCall[0];
  };

  const getAllEventsOfType = (type: TimerEvent["type"]) => {
    return listener.mock.calls.filter((x) => x["0"].type === type);
  };

  const passTimeInSeconds = async (seconds: number) =>
    vi.advanceTimersByTimeAsync(1000 * seconds);

  await vi.advanceTimersByTimeAsync(0);

  return {
    timer,
    listener,
    getLastEvent,
    getAllEventsOfType,
    passTimeInSeconds,
  };
}
