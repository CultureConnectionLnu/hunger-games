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
import { UpdateHub } from "./update-hub";

export function HubTable({
  params,
}: {
  params: { hubs: RouterOutputs["quest"]["allHubs"] };
}) {
  const [hubId, setHubId] = useSearchParamState("hubId");
  const [open, setOpen] = useSearchParamAsDialogState(hubId, setHubId);

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
      <UpdateHub
        params={{ hub: params.hubs.find((x) => x.id === hubId), open }}
        onDelete={() => setHubId(undefined)}
        onUpdate={() => setHubId(undefined)}
      />
    </Dialog>
  );
}
