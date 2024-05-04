import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { api } from "~/trpc/server";

export default async function UsersOverview() {
  const users = await api.user.allUsers.query();

  return (
    <Table>
      <TableCaption>All users</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>User ID</TableHead>
          <TableHead>Is Admin</TableHead>
          <TableHead>Is Moderator</TableHead>
          <TableHead>Is Player</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.userId}>
            <TableCell>{user.name}</TableCell>
            <TableCell>{user.userId}</TableCell>
            <TableCell>{user.isAdmin ? "✅" : "❌"}</TableCell>
            <TableCell>{user.isModerator ? "✅" : "❌"}</TableCell>
            <TableCell>{user.isPlayer ? "✅" : "❌"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
