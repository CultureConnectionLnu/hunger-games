import { TypedEventEmitter } from "~/lib/event-emitter";
import { getHandler } from "./base";

declare global {
  interface HungerGamesHandlers {
    ee?: TypedEventEmitter;
  }
}

export const ee = getHandler("ee", () => new TypedEventEmitter());
