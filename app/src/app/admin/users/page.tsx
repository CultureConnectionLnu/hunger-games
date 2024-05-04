import { api } from "~/trpc/server";
import { UserTable } from "./_components/user-table";

export default async function UsersOverview() {
  const users = await api.user.allUsers.query();

  return <UserTable params={{ users }} />;
}
