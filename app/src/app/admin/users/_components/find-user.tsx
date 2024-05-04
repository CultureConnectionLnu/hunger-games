"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { RouterOutputs } from "~/trpc/shared";
import { MdSearch } from "react-icons/md";
import { Combobox } from "~/app/_feature/combobox/combobox";
import { useQueryParamMutation } from "~/app/_feature/url-sync/query";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type User = UnwrapArray<RouterOutputs["user"]["allUsers"]>;

export function FindUser({ params }: { params: { users: User[] } }) {
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const mutateUserId = useQueryParamMutation("userId");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <MdSearch className="mr-2 h-4 w-4" />
          Find User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>Find User</DialogHeader>

        <Combobox
          options={params.users.map((user) => ({
            value: user.userId,
            label: user.name,
          }))}
          texts={{
            emptySelect: "Select user...",
            search: "Search user...",
            notFound: "No user with that name found.",
          }}
          value={selectedUserId}
          onChange={setSelectedUserId}
        />
        <DialogFooter className="flex flex-row justify-between">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button
            disabled={!selectedUserId}
            onClick={() => {
              setOpen(false);
              mutateUserId(selectedUserId);
            }}
          >
            Open
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
