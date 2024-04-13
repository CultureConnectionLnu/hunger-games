import { TimerFactory, type Timer } from "../timer";
import type { GetTimerEvents } from "../types";

type TimerConfig<T, Addition> =
  | {
      name: GetTimerEvents<T>;
      time: number;
      timeoutEvent?: () => void;
      normal?: false;
    }
  | {
      name: Addition;
      time: number;
      timeoutEvent?: () => void;
      normal: true;
    };

export class GameTimerHandler<T, Addition extends string = never> {
  private timers = new Map<GetTimerEvents<T> | Addition, Timer>();

  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private readonly emit: (eventData: any) => void,
    private readonly config: TimerConfig<T, Addition>[],
  ) {}

  getTimer<Name extends GetTimerEvents<T> | Addition>(name: Name) {
    return this.timers.get(name);
  }

  startTimer<Name extends GetTimerEvents<T> | Addition>(name: Name) {
    const config = this.config.find((x) => x.name === name);
    if (!config) {
      console.error(`Timer config not found for ${name as string}`);
      throw new Error(`Timer config not found for ${name as string}`);
    }

    const existingTimer = this.timers.get(name);
    if (existingTimer) {
      existingTimer.cancel();
    }

    const timer = TimerFactory.instance.create(config.time, name as string);
    this.timers.set(name, timer);

    if (config.timeoutEvent) {
      timer.once("timeout", config.timeoutEvent);
    }

    timer.on("timer", (e) => this.emit({ event: name as string, data: e }));
  }

  cancelTimer<Name extends GetTimerEvents<T> | Addition>(name: Name) {
    this.getTimer(name)?.cancel();
    this.timers.delete(name);
  }

  pauseAllTimers() {
    this.timers.forEach((timer) => {
      timer.pause();
    });
  }

  resumeAllTimers() {
    this.timers.forEach((timer) => {
      timer.resume();
    });
  }

  cleanup() {
    this.timers.forEach((timer) => {
      timer.cleanup();
    });
    this.timers.clear();
  }
}
