import { redirect } from "next/navigation";
import { checkRole } from "~/lib/role-check";
import { AddHub } from "./_components/add-hub";
import { HubTable } from "./_components/hub-table";

export default async function UsersOverview() {
  if (!(await checkRole("admin"))) {
    redirect("/");
  }

  return (
    <div className="flex h-full flex-col pb-4">
      <div className="flex-grow">
        <HubTable />
      </div>
      <div className="flex flex-row-reverse px-4">
        <AddHub />
      </div>
    </div>
  );
}
