declare global {
  interface KnownGames {}

  var KnownGameStores: KnownGames;
}
// this interface should be extended by each newly implemented game

export type AnyGame = {
  [K in keyof KnownGames]: { game: K; store: KnownGames[K] };
}[keyof KnownGames];

export function useGameStore<K extends keyof KnownGames>(
  game: K,
): KnownGames[K] {
  const store = globalThis.KnownGameStores[game];
  if (!store) {
    throw new Error(`Game store for ${game} not found.`);
  }
  return store();
}
