declare global {
  // eslint-disable-next-line no-var
  var handlers: HungerGamesHandlers;
}

export function getHandler<T extends keyof HungerGamesHandlers>(
  name: T,
  createNewInstance: () => HungerGamesHandlers[T],
) {
  if (globalThis.handlers === undefined) {
    globalThis.handlers = {};
  }
  if (!globalThis.handlers[name]) {
    globalThis.handlers[name] = createNewInstance();
  }
  return globalThis.handlers[name]!;
}
