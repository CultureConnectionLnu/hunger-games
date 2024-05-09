import {
  Table,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
  TableBody,
} from "~/components/ui/table";
import { type RouterOutputs } from "~/trpc/shared";

type Quest = NonNullable<RouterOutputs["quest"]["getCurrentQuestForPlayer"]>;

export function HubsTable({ hubs }: { hubs: Quest["additionalInformation"] }) {
  return (
    <Table>
      <TableCaption>Quest Hubs</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="w-auto flex-shrink-0">Visited</TableHead>
          <TableHead>Hub</TableHead>
          <TableHead>Moderator</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {hubs.map((hub) => (
          <TableRow key={hub.id}>
            <TableCell className="w-auto flex-shrink-0">
              {hub.visited ? "✅" : ""}
            </TableCell>
            <TableCell>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">{hub.name}</div>
                {hub.description ? (
                  <p className="text-sm text-muted-foreground">
                    {hub.description}
                  </p>
                ) : (
                  <></>
                )}
              </div>
            </TableCell>
            <TableCell>{hub.moderatorName}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
