import { api } from "~/trpc/server";
import { QuestTable } from "./_components/quest-table";
import { ScrollArea } from "~/components/ui/scroll-area";
import { FindUser } from "~/app/_components/find-user";

export default async function UsersOverview() {
  const quests = await api.quest.getOngoingQuestsForModerator.query();
  const users = await api.user.allUsers.query();

  /**
   * next steps:
   * - create a dialog that shows the selected user
   * - in the dialog it should show the current quest status of the user
   *   1. quest not related to this hub (should show where the user needs to go)
   *   2. provide button to mark the current hub as completed
   *   3. provide button to assign a new quest to user (for each quest type one button)
   *      - should have an alert dialog to confirm the assignment to avoid accidental assignments
   */

  return (
    <div className="flex h-full flex-col gap-4 pb-4">
      <div className="flex-grow"></div>
      <ScrollArea className="h-full">
        <QuestTable params={{ quests }} />
      </ScrollArea>
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
