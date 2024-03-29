import { GenericEventEmitter } from "~/lib/event-emitter";

export type TimerEvent = {
  startTimeUnix: number;
  timeoutAfterSeconds: number;
  secondsLeft: number;
};

const defaultTimeFunctions = {
  setTimeout: setTimeout as (
    callback: (args: void) => void,
    ms?: number,
  ) => NodeJS.Timeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
};

export class TimeFunctions {
  private static _instance: TimeFunctions;
  static get instance() {
    if (!TimeFunctions._instance) {
      TimeFunctions._instance = new TimeFunctions();
    }
    return TimeFunctions._instance;
  }

  private funcs = defaultTimeFunctions;

  get setTimeout() {
    return this.funcs.setTimeout;
  }
  get clearTimeout() {
    return this.funcs.clearTimeout;
  }
  get setInterval() {
    return this.funcs.setInterval;
  }
  get clearInterval() {
    return this.funcs.clearInterval;
  }

  public mock(funcs: Partial<typeof defaultTimeFunctions>) {
    this.funcs = { ...defaultTimeFunctions, ...funcs };
  }

  public useReal() {
    this.funcs = defaultTimeFunctions;
  }
}

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

    this.timeout = TimeFunctions.instance.setTimeout(() => {
      this.emit("timeout", undefined);
      this.cleanup();
    }, 1000 * timeoutAfterSeconds);

    this.interval = TimeFunctions.instance.setInterval(() => {
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
    TimeFunctions.instance.clearTimeout(this.timeout);
    TimeFunctions.instance.clearInterval(this.interval);
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
