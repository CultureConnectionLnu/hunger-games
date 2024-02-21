import { GenericEventEmitter } from "~/lib/event-emitter";

// this must be placed in this file to remove the circular dependency
export abstract class BaseGame<
  T extends Record<string, unknown>,
> extends GenericEventEmitter<
  T & {
    // game finished
    end: { winner: string };
    // emitted upon game destruction
    destroy: void;
  }
> {
  constructor(
    public readonly fightId: string,
    public readonly players: string[],
  ) {
    super();
  }
  abstract destroy(): void;
}
