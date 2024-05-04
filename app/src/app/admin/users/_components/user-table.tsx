"use client";

import { Dialog } from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  useSearchParamAsDialogState,
  useSearchParamState,
} from "~/app/_feature/url-sync/query";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import type { RouterOutputs } from "~/trpc/shared";
import { UpdateUserForm } from "./form";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type User = UnwrapArray<RouterOutputs["user"]["allUsers"]>;

export function UserTable({ params }: { params: { users: User[] } }) {
  const router = useRouter();
  const [userId, setUserId] = useSearchParamState("userId");
  const [open, setOpen] = useSearchParamAsDialogState(userId, setUserId);
  const [user, setUser] = useState<User>();

  useEffect(() => {
    const existingUser = params.users.find((x) => x.userId === userId);
    if (!existingUser) {
      setUserId(undefined);
      return;
    }

    setUser(existingUser);
  }, [setUser, setUserId, params.users, userId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          {params.users.map((user) => (
            <TableRow key={user.userId} onClick={() => setUserId(user.userId)}>
              <TableCell>{user.name}</TableCell>
              <TableCell>{user.userId}</TableCell>
              <TableCell>{user.isAdmin ? "✅" : "❌"}</TableCell>
              <TableCell>{user.isModerator ? "✅" : "❌"}</TableCell>
              <TableCell>{user.isPlayer ? "✅" : "❌"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {user && (
        <UpdateUserForm
          params={{
            allUsers: params.users,
            user: user,
            open,
          }}
          onDone={() => {
            setUserId(undefined);
            router.refresh();
          }}
        />
      )}
    </Dialog>
  );
}
