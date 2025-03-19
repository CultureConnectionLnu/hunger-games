"use client";

const GameTypeToTitleMap = {
  "rock-paper-scissors": "Rock Paper Scissors",
} satisfies Record<GameType, string>;

type GameType = NonNullable<
  ClientStore["game"]["mutable"]["gameSpecific"]
>["type"];

export function useGameName(gameType: GameType | undefined | null) {
  if (!gameType) return "";
  return GameTypeToTitleMap[gameType];
}
