"use client";

import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTrigger } from "~/components/ui/dialog";
import type { RouterOutputs } from "~/trpc/shared";
import { MdSearch } from "react-icons/md";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type User = UnwrapArray<RouterOutputs["user"]["allUsers"]>;

export function FindUser({ params }: { params: { users: User[] } }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <MdSearch className="mr-2 h-4 w-4" />
          Find User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
            Find User
        </DialogHeader>
        <div>find user</div>
        <DialogFooter className="flex flex-row justify-between">
            <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
