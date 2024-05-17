import { api } from "~/trpc/server";
import { UserTable } from "./_components/user-table";
import { ScrollArea } from "~/components/ui/scroll-area";
import { FindUser } from "~/app/_components/find-user";

export const dynamic = "force-dynamic";

export default async function UsersOverview() {
  const users = await api.user.allUsers.query().catch(() => []);

  return (
    <div className="flex h-full flex-col gap-4 pb-4">
      <ScrollArea className="h-full">
        <UserTable params={{ users }} />
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
