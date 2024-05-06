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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { QrCodeScanner } from "~/app/_feature/qrcode/qr-code-scanner";
import { Card, CardHeader } from "~/components/ui/card";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type User = UnwrapArray<RouterOutputs["user"]["allUsers"]>;

export function FindUser({
  params,
  text,
}: {
  params: { users: User[] };
  text: {
    dialogTrigger: string;
    dialogHeader: string;
    selectButton: string;
  };
}) {
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const mutateUserId = useQueryParamMutation("userId");

  const selectedUser = params.users.find(
    (user) => user.userId === selectedUserId,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <MdSearch className="mr-2 h-4 w-4" />
          {text.dialogTrigger}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>{text.dialogHeader}</DialogHeader>
        <Tabs>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text">Text</TabsTrigger>
            <TabsTrigger value="qr-code">Qr Code</TabsTrigger>
          </TabsList>
          <TabsContent value="text">
            <Combobox
              className="w-full"
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
          </TabsContent>
          <TabsContent value="qr-code">
            <QrCodeScanner
              onReadUserId={(userId) => setSelectedUserId(userId)}
            />
          </TabsContent>
        </Tabs>
        <Card>
          <CardHeader>
            {selectedUserId === undefined && selectedUser === undefined && (
              <p>No selection</p>
            )}
            {selectedUserId !== undefined && selectedUser === undefined && (
              <p>Unknown user id</p>
            )}
            {selectedUser !== undefined && <p>{selectedUser.name}</p>}
          </CardHeader>
        </Card>
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
            {text.selectButton}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
