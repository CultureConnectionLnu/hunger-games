import { api } from "~/trpc/server";
import { NoQuest } from "./_components/no-quest";
import { WalkQuest } from "./_components/walk-quest";

export default async function QuestHistory() {
  const quest = await api.quest.getCurrentQuestForPlayer.query();

  if (!quest) {
    return <NoQuest />;
  }

  return <WalkQuest params={{ quest }} />;
}
