import { api } from "~/trpc/server";
import { QuestTable } from "./_components/quest-table";

export default async function QuestHistory() {
  const quests = await api.quest.getAllQuestsFromPlayer.query();

  return (
    <div className="flex h-full flex-col pb-4">
      <div className="flex-grow">
        <QuestTable params={{ quests }} />
      </div>
    </div>
  );
}
