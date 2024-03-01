import { GenericEventEmitter } from "~/lib/event-emitter";

export type TimerEvent = {
  startTimeUnix: number;
  timeoutAfterSeconds: number;
  secondsLeft: number;
};

export type GetTimerEvents<T> = keyof {
  [Key in keyof T as T[Key] extends TimerEvent ? Key : never]: Key;
};

export class TimeoutCounter extends GenericEventEmitter<{
  start: void;
  countdown: {
    startTimeUnix: number;
    timeoutAfterSeconds: number;
    secondsLeft: number;
  };
  timeout: void;
  canceled: void;
}> {
  private startTimeUnix;
  private secondsCounter;
  private timeout?;
  private interval?;

  constructor(public readonly timeoutAfterSeconds: number) {
    super();
    this.startTimeUnix = Date.now();
    this.secondsCounter = 0;

    this.timeout = setTimeout(() => {
      this.emit("timeout", undefined);
      this.cleanup();
    }, 1000 * timeoutAfterSeconds);

    this.interval = setInterval(() => {
      // one second passed
      this.secondsCounter++;
      this.emitCountdown();
    }, 1000);

    void Promise.resolve().then(() => {
      // make sure that it is not emitted immediately
      this.emit("start", undefined);
      this.emitCountdown();
    });
  }

  public cancel() {
    if (!this.timeout) return;
    this.emit("canceled", undefined);
    this.cleanup();
  }

  private cleanup() {
    clearTimeout(this.timeout);
    clearInterval(this.interval);
    this.timeout = undefined;
    this.interval = undefined;
    this.removeAllListeners();
  }

  private emitCountdown() {
    this.emit("countdown", {
      startTimeUnix: this.startTimeUnix,
      timeoutAfterSeconds: this.timeoutAfterSeconds,
      secondsLeft: this.timeoutAfterSeconds - this.secondsCounter,
    });
  }
}
