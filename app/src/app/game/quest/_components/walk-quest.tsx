import Link from "next/link";
import { HubsTable } from "~/app/_feature/quest/hubs-table";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
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
        <Link href="/game/overview">
          <Button variant="outline">Return to Overview</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

export function kindToText(kind: Quest["kind"]) {
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
