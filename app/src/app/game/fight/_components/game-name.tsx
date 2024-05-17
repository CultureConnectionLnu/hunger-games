import { type KnownGames } from "~/server/api/logic/handler";

export function GameName({ gameName }: { gameName?: KnownGames }) {
  return <>{getReadableGameName(gameName)}</>;
}

function getReadableGameName(gameName?: KnownGames) {
  switch (gameName) {
    case "rock-paper-scissors":
      return "Rock Paper Scissors";
    case "ordered-memory":
      return "Ordered Memory";
    case "typing":
      return "Typing";
    default:
      return "No Game";
  }
}
