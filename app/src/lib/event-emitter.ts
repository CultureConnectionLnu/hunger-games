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

export class GenericEventEmitter<Events extends BaseEvent> {
  private emitter = new EventEmitter();

  emit<TEventName extends keyof Events & string>(
    eventName: TEventName,
    eventArg: Events[TEventName],
  ): boolean;
  emit<TEventName extends string>(
    eventName: TEventName,
    eventArg: any,
  ): boolean {
    return this.emitter.emit(eventName, eventArg);
  }

  on<TEventName extends keyof Events & string>(
    eventName: TEventName,
    handler: (eventArg: Events[TEventName]) => void,
  ): this;
  on<TEventName extends string>(
    eventName: TEventName,
    handler: (eventArg: any) => void,
  ): this {
    this.emitter.on(eventName, handler);
    return this;
  }

  once<TEventName extends keyof Events & string>(
    eventName: TEventName,
    handler: (eventArg: Events[TEventName]) => void,
  ): this;
  once<TEventName extends string>(
    eventName: TEventName,
    handler: (eventArg: any) => void,
  ): this {
    this.emitter.once(eventName, handler);
    return this;
  }

  off<TEventName extends keyof Events & string>(
    eventName: TEventName,
    handler: (eventArg: Events[TEventName]) => void,
  ): this;
  off<TEventName extends string>(
    eventName: TEventName,
    handler: (eventArg: any) => void,
  ): this {
    this.emitter.off(eventName, handler);
    return this;
  }

  removeListener<TEventName extends string>(
    eventName: TEventName,
    handler: (eventArg: any) => void,
  ): this {
    this.emitter.removeListener(eventName, handler);
    return this;
  }

  protected removeAllListeners(): void {
    this.emitter.removeAllListeners();
  }
}
