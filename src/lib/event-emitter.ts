/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line no-restricted-imports
import { EventEmitter } from "node:events";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface KnownEvents {
  // to be extended by other modules
}

export class TypedEventEmitter{
  private emitter = new EventEmitter();

  emit<TEventName extends keyof KnownEvents>(
    eventName: TEventName,
    eventArg: KnownEvents[TEventName]
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
