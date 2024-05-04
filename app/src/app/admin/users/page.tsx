import { api } from "~/trpc/server";
import { UserTable } from "./_components/user-table";
import { FindUser } from "./_components/find-user";
import { ScrollArea } from "~/components/ui/scroll-area";

export default async function UsersOverview() {
  const users = await api.user.allUsers.query();

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
        />
      </div>
    </div>
  );
}
