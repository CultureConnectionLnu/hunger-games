"use client";

import {
  useSearchParamAsDialogState,
  useSearchParamState,
} from "~/app/_feature/url-sync/query";
import { Dialog } from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { type RouterOutputs } from "~/trpc/shared";
import { UpdateHubForm } from "./form";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type Hub = UnwrapArray<RouterOutputs["quest"]["allHubs"]>;

export function HubTable({
  params,
}: {
  params: {
    allUsers: { id: string; name: string }[];
    hubs: Hub[];
  };
}) {
  const router = useRouter();
  const [hubId, setHubId] = useSearchParamState("hubId");
  const [open, setOpen] = useSearchParamAsDialogState(hubId, setHubId);
  const [hub, setHub] = useState<Hub>();

  useEffect(() => {
    setHub(params.hubs.find((x) => x.id === hubId));
  }, [setHub, hubId, params.hubs]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Table>
        <TableCaption>All Hubs</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Moderator</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {params.hubs.map((hub) => (
            <TableRow key={hub.id} onClick={() => setHubId(hub.id)}>
              <TableCell>{hub.name}</TableCell>
              <TableCell>{hub.description}</TableCell>
              <TableCell>
                {hub.assignedModerator ? hub.assignedModerator.name : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {hub && (
        <UpdateHubForm
          params={{
            allUsers: params.allUsers,
            hub,
            open,
          }}
          onDone={() => {
            setHubId(undefined);
            router.refresh();
          }}
        />
      )}
    </Dialog>
  );
}
