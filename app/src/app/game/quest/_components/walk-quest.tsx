import Link from "next/link";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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

type Quest = NonNullable<RouterOutputs["quest"]["getCurrentQuestForPlayer"]>;

export function WalkQuest({
  params,
}: {
  params: {
    quest: Quest;
  };
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Walk Quest with {kindToText(params.quest.kind)}</CardTitle>
        <CardDescription>
          To complete this quest, you need to visit the listed hubs.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <HubsTable hubs={params.quest.additionalInformation} />
      </CardContent>
      <CardFooter>
        <Link href="/game/qr-code">
          <Button variant="outline">Return to QrCode</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function HubsTable({ hubs }: { hubs: Quest["additionalInformation"] }) {
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

function kindToText(kind: Quest["kind"]) {
  switch (kind) {
    case "walk-1":
      return "one stop";
    case "walk-2":
      return "two stops";
    case "walk-3":
      return "three stops";
    default:
      return kind;
  }
}
