import { GenericEventEmitter } from "~/lib/event-emitter";

export class TimeoutCounter extends GenericEventEmitter<{
  start: {
    startTimeUnix: number;
    timeoutAfterSeconds: number;
  };
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
      this.emit("countdown", {
        startTimeUnix: this.startTimeUnix,
        timeoutAfterSeconds,
        secondsLeft: timeoutAfterSeconds - this.secondsCounter,
      });
    }, 1000);

    void Promise.resolve().then(() => {
      // make sure that it is not emitted immediately
      this.emit("start", {
        startTimeUnix: this.startTimeUnix,
        timeoutAfterSeconds,
      });
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
}
