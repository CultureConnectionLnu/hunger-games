import { GenericEventEmitter } from "~/lib/event-emitter";

export type TimerEvent =
  | {
      type: "start";
      secondsLeft: number;
      running: boolean;
    }
  | {
      type: "update";
      secondsLeft: number;
      running: boolean;
    }
  | {
      type: "pause";
      secondsLeft: number;
      running: boolean;
    }
  | {
      type: "resume";
      secondsLeft: number;
      running: boolean;
    }
  | {
      type: "end";
      secondsLeft: number;
      running: boolean;
    };

export type Timer = GenericEventEmitter<{
  start: void;
  timer: TimerEvent;
  timeout: void;
  canceled: void;
}> & {
  readonly name: string;
  cancel(): void;
  pause(): void;
  resume(): void;
  cleanup(): void;
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
    this.manualLookup.forEach((timer) => timer.cleanup());
    this.manualLookup = [];
  }
}

abstract class TimerLogic extends GenericEventEmitter<{
  start: void;
  timer: TimerEvent;
  timeout: void;
  canceled: void;
}> {
  private secondsCounter;
  private cancelWasCalled = false;
  private wasStarted = false;
  private running = true;

  public get isCanceled() {
    return this.cancelWasCalled;
  }

  public get isRunning() {
    if (!this.wasStarted) return false;
    if (this.isCanceled) return false;
    return this.running;
  }

  public get secondsLeft() {
    return this.timeoutAfterSeconds - this.secondsCounter;
  }

  constructor(
    public readonly timeoutAfterSeconds: number,
    public readonly name: string,
  ) {
    super();
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

  public pause() {
    this.running = false;
    this.emitTimer("pause");
  }

  public resume() {
    this.running = true;
    this.emitTimer("resume");
  }

  public emitTimeout() {
    this.emit("timeout", undefined);
    this.running = false;
    this.cleanup();
  }

  public emitNextSecond() {
    this.secondsCounter++;
    this.emitCountdown();
  }

  public abstract cleanup(): void;

  private emitCountdown() {
    if (!this.wasStarted) {
      this.emitTimer("start");
      this.wasStarted = true;
      return;
    }
    if (this.secondsLeft !== 0) {
      this.emitTimer("update");
      return;
    }
    this.emitTimer("end");
  }

  private emitTimer(type: TimerEvent["type"]) {
    this.emit("timer", {
      type,
      secondsLeft: this.secondsLeft,
      running: this.running,
    });
  }
}

class AutomaticTimer extends TimerLogic {
  private timeout?: NodeJS.Timeout;
  private interval?: NodeJS.Timeout;

  constructor(timeoutAfterSeconds: number, name: string) {
    super(timeoutAfterSeconds, name);
    this.startAutomatic(timeoutAfterSeconds);
  }

  public pause(): void {
    super.pause();
    this.stopAutomatic();
  }

  public resume(): void {
    super.resume();
    this.startAutomatic(this.secondsLeft);
  }

  public cleanup() {
    this.stopAutomatic();
    this.timeout = undefined;
    this.interval = undefined;
    this.removeAllListeners();
  }

  private stopAutomatic() {
    clearTimeout(this.timeout);
    clearInterval(this.interval);
  }

  private startAutomatic(timeoutAfterSeconds: number) {
    const offsetToEnsureTimeoutAfterInterval = 50;
    this.timeout = setTimeout(
      () => this.emitTimeout(),
      1000 * timeoutAfterSeconds + offsetToEnsureTimeoutAfterInterval,
    );

    this.interval = setInterval(() => this.emitNextSecond(), 1000);
  }
}

class ManualTimer extends TimerLogic {
  public cleanup() {
    this.removeAllListeners();
  }
}
