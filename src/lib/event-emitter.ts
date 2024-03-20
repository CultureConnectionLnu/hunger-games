/* eslint-disable @typescript-eslint/ban-types */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line no-restricted-imports
import { EventEmitter } from "node:events";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface KnownEvents {
  // to be extended by other modules
}

export class TypedEventEmitter {
  private emitter = new EventEmitter();

  emit<TEventName extends keyof KnownEvents>(
    eventName: TEventName,
    eventArg: KnownEvents[TEventName],
  ) {
    this.emitter.emit(eventName, eventArg);
  }

  on<TEventName extends keyof KnownEvents>(
    eventName: TEventName,
    handler: (eventArg: KnownEvents[TEventName]) => void,
  ) {
    this.emitter.on(eventName, handler);
  }

  off<TEventName extends keyof KnownEvents>(
    eventName: TEventName,
    handler: (eventArg: KnownEvents[TEventName]) => void,
  ) {
    this.emitter.off(eventName, handler);
  }
}

export type BaseEvent = Record<string, any>;
export type DefaultEvents = {}

export class GenericEventEmitter<
  FirstLevelEvents extends BaseEvent,
  SecondLevelEvents extends BaseEvent = DefaultEvents
> {
  private emitter = new EventEmitter();

  emit<TEventName extends keyof FirstLevelEvents & string>(
    eventName: TEventName,
    eventArg: FirstLevelEvents[TEventName],
  ): boolean;
  emit<TEventName extends keyof SecondLevelEvents & string>(
    eventName: TEventName,
    eventArg: SecondLevelEvents[TEventName],
  ): boolean;
  emit<TEventName extends string>(
    eventName: TEventName,
    eventArg: any,
  ): boolean {
    return this.emitter.emit(eventName, eventArg);
  }

  on<TEventName extends keyof FirstLevelEvents & string>(
    eventName: TEventName,
    handler: (eventArg: FirstLevelEvents[TEventName]) => void,
  ): this;
  on<TEventName extends keyof SecondLevelEvents & string>(
    eventName: TEventName,
    handler: (eventArg: SecondLevelEvents[TEventName]) => void,
  ): this;
  on<TEventName extends string>(
    eventName: TEventName,
    handler: (eventArg: any) => void,
  ): this {
    this.emitter.on(eventName, handler);
    return this;
  }

  once<TEventName extends keyof FirstLevelEvents & string>(
    eventName: TEventName,
    handler: (eventArg: FirstLevelEvents[TEventName]) => void,
  ): this;
  once<TEventName extends keyof SecondLevelEvents & string>(
    eventName: TEventName,
    handler: (eventArg: SecondLevelEvents[TEventName]) => void,
  ): this;
  once<TEventName extends string>(
    eventName: TEventName,
    handler: (eventArg: any) => void,
  ): this {
    this.emitter.once(eventName, handler);
    return this;
  }

  off<TEventName extends keyof FirstLevelEvents & string>(
    eventName: TEventName,
    handler: (eventArg: FirstLevelEvents[TEventName]) => void,
  ): this;
  off<TEventName extends keyof SecondLevelEvents & string>(
    eventName: TEventName,
    handler: (eventArg: SecondLevelEvents[TEventName]) => void,
  ): this;
  off<TEventName extends string>(
    eventName: TEventName,
    handler: (eventArg: any) => void,
  ): this {
    this.emitter.off(eventName, handler);
    return this;
  }

  protected removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
