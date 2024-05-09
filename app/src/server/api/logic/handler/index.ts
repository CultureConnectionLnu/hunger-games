declare global {
  // eslint-disable-next-line no-var
  var services: HungerGamesServices;
}
globalThis.services = globalThis.services ?? {};

export * from "./clerk";
export * from "./user";
export * from "./score";
export * from "./quest";
export * from "./hub";
export * from "./lobby";
