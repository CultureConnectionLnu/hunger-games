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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type User = UnwrapArray<RouterOutputs["user"]["allUsers"]>;

export function UserTable({ params }: { params: { users: User[] } }) {
  const router = useRouter();
  const [userId, setUserId] = useSearchParamState("userId");
  const [open, setOpen] = useSearchParamAsDialogState(userId, setUserId);
  const [user, setUser] = useState<User>();

  useEffect(() => {
    setUser(params.users.find((x) => x.userId === userId));
  }, [setUser, params.users, userId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Table>
        <TableCaption>All users</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Admin</TableHead>
            <TableHead>Mod</TableHead>
            <TableHead>Medic</TableHead>
            <TableHead>Player</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {params.users.map((user) => (
            <TableRow key={user.userId} onClick={() => setUserId(user.userId)}>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger>{user.name}</TooltipTrigger>
                  <TooltipContent>{user.userId}</TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>{user.isAdmin ? "✅" : "❌"}</TableCell>
              <TableCell>{user.isModerator ? "✅" : "❌"}</TableCell>
              <TableCell>{user.isMedic ? "✅" : "❌"}</TableCell>
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
