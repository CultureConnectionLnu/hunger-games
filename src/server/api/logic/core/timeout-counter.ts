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

  private clazz: new (timeout: number, name: string) => Timer = AutomaticTimer;

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

abstract class TimerLogic extends GenericEventEmitter<{
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
  private cancelWasCalled = false;

  public get isCanceled() {
    return this.cancelWasCalled;
  }

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
    this.secondsCounter = this.timeoutAfterSeconds;
    this.emitCountdown();
    this.cleanup();
    this.cancelWasCalled = true;
  }

  public emitTimeout() {
    this.emit("timeout", undefined);
    this.cleanup();
  }

  public emitNextSecond() {
    this.secondsCounter++;
    this.emitCountdown();
  }

  protected abstract cleanup(): void;

  private emitCountdown() {
    this.emit("countdown", {
      startTimeUnix: this.startTimeUnix,
      timeoutAfterSeconds: this.timeoutAfterSeconds,
      secondsLeft: this.timeoutAfterSeconds - this.secondsCounter,
    });
  }
}

class AutomaticTimer extends TimerLogic {
  private timeout?;
  private interval?;

  constructor(timeoutAfterSeconds: number, name: string) {
    super(timeoutAfterSeconds, name);

    const offsetToEnsureTimeoutAfterInterval = 50;
    this.timeout = setTimeout(
      () => this.emitTimeout(),
      1000 * timeoutAfterSeconds + offsetToEnsureTimeoutAfterInterval,
    );

    this.interval = setInterval(() => this.emitNextSecond(), 1000);
  }

  protected cleanup() {
    clearTimeout(this.timeout);
    clearInterval(this.interval);
    this.timeout = undefined;
    this.interval = undefined;
    this.removeAllListeners();
  }
}

class ManualTimer extends TimerLogic {
  protected cleanup() {
    this.removeAllListeners();
  }
}
