"use client";

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
type Quest = UnwrapArray<RouterOutputs["quest"]["getAllQuestsFromPlayer"]>;

export function QuestTable({
  params,
}: {
  params: {
    quests: Quest[];
  };
}) {
  return (
    <Table>
      <TableCaption>Quest History</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Started</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {params.quests.map((quest) => (
          <TableRow key={quest.id}>
            <TableCell>{quest.kind}</TableCell>
            <TableCell>{getProgress(quest)}</TableCell>
            <TableCell>{quest.createdAt.toLocaleTimeString()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function getProgress(quest: Quest) {
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
