import { Temporal } from "temporal-polyfill";

export class Timer {
  private timerId: NodeJS.Timeout | null = null;
  private remainingTime;
  private canceled = false;

  get isCanceled() {
    return this.canceled;
  }

  constructor(
    private duration: Temporal.Duration,
    private callback: () => void,
  ) {
    this.remainingTime = duration;
  }

  startOrResume() {
    if (this.timerId !== null || this.canceled) return; // Timer is already running1

    const milliseconds = this.durationToMilliseconds(this.remainingTime);
    this.timerId = setTimeout(() => {
      this.callback();
      this.timerId = null;
    }, milliseconds);
  }

  pause() {
    if (this.timerId === null || this.canceled) return; // Timer is not running

    clearTimeout(this.timerId);
    this.timerId = null;

    const endTime = Temporal.Now.instant().add(this.remainingTime);
    const now = Temporal.Now.instant();
    this.remainingTime = endTime.since(now);
  }

  cancel() {
    this.canceled = true;

    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private durationToMilliseconds(duration: Temporal.Duration): number {
    return duration.total({ unit: "milliseconds" });
  }
}

// Usage example:
const duration = Temporal.Duration.from({ seconds: 10 });
const timer = new Timer(duration, () => {
  console.log("Timer completed!");
});

// Start or resume the timer
timer.startOrResume();

// To pause the timer
timer.pause();

// To cancel the timer
timer.cancel();
