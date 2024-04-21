import { redirect } from "next/navigation";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { checkRole } from "~/lib/role-check";
import { api } from "~/trpc/server";

export default async function UsersOverview() {
  if (!(await checkRole("admin"))) {
    redirect("/");
  }

  const hubs = await api.quest.allHubs.query();

  return (
    <Table>
      <TableCaption>All users</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>User ID</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {hubs.map((hub) => (
          <TableRow key={hub.id}>
            <TableCell>{hub.name}</TableCell>
            <TableCell>{hub.description}</TableCell>
            <TableCell>
              {hub.assignedModerator ? hub.assignedModerator.name : "-"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
