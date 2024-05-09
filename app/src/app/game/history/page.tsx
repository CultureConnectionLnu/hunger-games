import { api } from "~/trpc/server";
import { HistoryTabs } from "./_components/tabs";

export default async function History() {
  const quests = await api.quest.getAllQuestsFromPlayer.query();
  const scores = await api.score.getHistory.query();
  const fights = await api.lobby.getAllMyFights.query();
  const currentScore = await api.score.getCurrentScore.query();

  return <HistoryTabs params={{ quests, scores, fights, currentScore }} />;
}
