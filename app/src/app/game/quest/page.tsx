import { api } from "~/trpc/server";
import { NoQuest } from "./_components/no-quest";
import { WalkQuest } from "./_components/walk-quest";

export default async function QuestHistory() {
  const quest = await api.quest.getCurrentQuestForPlayer.query();

  if (!quest) {
    return     <div className="flex h-full flex-col justify-center px-4"><NoQuest /></div>;
  }

  return <WalkQuest params={{ quest }} />;
}
