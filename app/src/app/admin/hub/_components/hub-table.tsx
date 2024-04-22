"use client";

import { type RouterOutputs } from "~/trpc/shared";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Dialog } from "~/components/ui/dialog";
import {
  useSearchParamAsDialogState,
  useSearchParamState,
} from "~/app/_feature/url-sync/query";
import { UpdateHub } from "./update-hub";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";

export function HubTable() {
  const [hubId, setHubId] = useSearchParamState("hubId");
  const [open, setOpen] = useSearchParamAsDialogState(hubId, setHubId);
  const { isLoading, data } = api.quest.allHubs.useQuery();

  const loadingFiller = (
    <TableRow>
      <TableCell>
        <Skeleton className="h-4 w-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-full" />
      </TableCell>
      <TableCell>
        <Skeleton className="h-4 w-full" />
      </TableCell>
    </TableRow>
  );
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
          {isLoading || !data
            ? loadingFiller
            : data.map((hub) => (
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
      <UpdateHub
        params={{ hub: data?.find((x) => x.id === hubId), open }}
        onDelete={() => setHubId(undefined)}
        onUpdate={() => setHubId(undefined)}
      />
    </Dialog>
  );
}
