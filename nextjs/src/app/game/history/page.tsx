import { api } from "~/server/api";
import { HistoryTabs } from "./_components/tabs";

export default async function History() {
  // const quests = await api.quest.getAllQuestsFromPlayer.query();
  // const scores = await api.score.getHistory.query();
  const matchesResult = await api.game.getAllMyMatches();
  // const currentScore = await api.score.getCurrentScore.query();

  const matches = matchesResult.isErr() ? [] : matchesResult.value;

  return <HistoryTabs params={{ matches }} />;
}
