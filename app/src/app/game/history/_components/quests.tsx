"use client";

import { useQueryParamMutation } from "~/app/_feature/url-sync/query";
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

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type QuestEntry = UnwrapArray<RouterOutputs["quest"]["getAllQuestsFromPlayer"]>;

export function QuestHistory({ params }: { params: { quests: QuestEntry[] } }) {
  const questId = useQueryParamMutation("questId");

  return (
    <Table>
      <TableCaption>Your Quest History</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Started</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {params.quests.map((quest) => (
          <TableRow key={quest.id} onClick={() => questId(quest.id)}>
            <TableCell>{quest.kind}</TableCell>
            <TableCell>{getProgress(quest)}</TableCell>
            <TableCell>{quest.createdAt.toLocaleTimeString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function getProgress(quest: QuestEntry) {
  if (quest.outcome === "completed") {
    return "Completed";
  }
  if (quest.outcome === "lost-in-battle") {
    return "Lost in Battle";
  }
  const visitedHubs = quest.additionalInformation.hubs.filter(
    (x) => x.visited,
  ).length;
  return `${visitedHubs}/${quest.additionalInformation.hubs.length}`;
}
