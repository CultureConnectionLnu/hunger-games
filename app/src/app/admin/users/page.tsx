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
  const users = await api.user.allUsers.query();

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
        {users.map((user) => (
          <TableRow key={user.userId}>
            <TableCell>{user.name}</TableCell>
            <TableCell>{user.userId}</TableCell>
            <TableCell>{user.role}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
