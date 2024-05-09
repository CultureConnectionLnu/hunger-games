import { api } from "~/trpc/server";
import { QuestTable } from "./_components/quest-table";
import { ScrollArea } from "~/components/ui/scroll-area";
import { FindUser } from "~/app/_components/find-user";
import { UserDialog } from "./_components/user-dialog";

export default async function UsersOverview() {
  const quests = await api.quest.getOngoingQuestsForModerator.query();
  const users = await api.user.allPlayer.query();

  return (
    <div className="flex h-full flex-col gap-4 pb-4">
      <div className="flex-grow"></div>
      <ScrollArea className="h-full">
        <QuestTable params={{ quests }} />
      </ScrollArea>
      <UserDialog />
      <div className="flex flex-row-reverse px-4">
        <FindUser
          params={{
            users,
          }}
          text={{
            dialogTrigger: "Find User",
            dialogHeader: "Select a user",
            selectButton: "Select",
          }}
        />
      </div>
    </div>
  );
}
