import { redirect } from "next/navigation";
import { checkRole } from "~/lib/role-check";
import { api } from "~/trpc/server";
import { AddHub } from "./_components/add-hub";
import { HubTable } from "./_components/hub-table";

export default async function UsersOverview() {
  if (!(await checkRole("admin"))) {
    redirect("/");
  }

  const users = await api.user.allUsers.query();
  const hubs = await api.quest.allHubs.query();

  return (
    <div className="flex h-full flex-col pb-4">
      <div className="flex-grow">
        <HubTable params={{ hubs }} />
      </div>
      <div className="flex flex-row-reverse px-4">
        <AddHub
          params={{
            allUsers: users.map(({ name, userId }) => ({ id: userId, name })),
          }}
        />
      </div>
    </div>
  );
}
