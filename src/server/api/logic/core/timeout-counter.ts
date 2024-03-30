import { GenericEventEmitter } from "~/lib/event-emitter";

export type TimerEvent = {
  startTimeUnix: number;
  timeoutAfterSeconds: number;
  secondsLeft: number;
};

export type Timer = GenericEventEmitter<{
  start: void;
  countdown: {
    startTimeUnix: number;
    timeoutAfterSeconds: number;
    secondsLeft: number;
  };
  timeout: void;
  canceled: void;
}> & {
  readonly name: string;
  cancel: () => void;
};

export class TimerFactory {
  private static _instance: TimerFactory;
  static get instance() {
    if (!TimerFactory._instance) {
      TimerFactory._instance = new TimerFactory();
    }
    return TimerFactory._instance;
  }

  private clazz: new (
    timeout: number,
    name: string,
  ) => Timer = AutomaticTimer;

  public manualLookup: ManualTimer[] = [];

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public create(timeoutAfterSeconds: number, name: string) {
    const timeout = new this.clazz(timeoutAfterSeconds, name);
    if (timeout instanceof ManualTimer) {
      this.manualLookup.push(timeout);
    }
    return timeout;
  }

  public useManual() {
    this.clazz = ManualTimer;
  }
  public useAutomatic() {
    this.clazz = AutomaticTimer;
    this.manualLookup = [];
  }
}

class AutomaticTimer extends GenericEventEmitter<{
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

  constructor(
    public readonly timeoutAfterSeconds: number,
    public readonly name: string,
  ) {
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

class ManualTimer extends GenericEventEmitter<{
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

  constructor(
    public readonly timeoutAfterSeconds: number,
    public readonly name: string,
  ) {
    super();
    this.startTimeUnix = Date.now();
    this.secondsCounter = 0;
    void Promise.resolve().then(() => {
      // make sure that it is not emitted immediately
      this.emit("start", undefined);
      this.emitCountdown();
    });
  }

  public cancel() {
    this.emit("canceled", undefined);
    this.cleanup();
  }

  public emitTimeout() {
    this.emit("timeout", undefined);
  }

  public emitNextSecond() {
    this.secondsCounter++;
    this.emitCountdown();
  }

  private cleanup() {
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