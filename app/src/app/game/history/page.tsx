import { api } from "~/trpc/server";
import { HistoryTabs } from "./_components/tabs";

export default async function History() {
  const quests = await api.quest.getAllQuestsFromPlayer.query();

  return <HistoryTabs />;
}
