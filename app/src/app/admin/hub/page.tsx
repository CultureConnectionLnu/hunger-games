import { api } from "~/trpc/server";
import { HubTable } from "./_components/hub-table";
import { AddHubForm } from "./_components/form";

export default async function UsersOverview() {
  const users = await api.user.allUsers.query();
  const hubs = await api.quest.allHubs.query();
  const allUsers = users.map(({ name, userId }) => ({ id: userId, name }));

  return (
    <div className="flex h-full flex-col pb-4">
      <div className="flex-grow">
        <HubTable params={{ hubs, allUsers }} />
      </div>
      <div className="flex flex-row-reverse px-4">
        <AddHubForm
          params={{
            allUsers,
          }}
        />
      </div>
    </div>
  );
}
