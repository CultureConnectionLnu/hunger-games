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
type Quest = UnwrapArray<RouterOutputs["quest"]["allOngoingQuests"]>;

export function QuestTable({
  params,
}: {
  params: {
    quests: Quest[];
  };
}) {
  return (
    <Table>
      <TableCaption>All Ongoing Quests</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Player</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Progress</TableHead>
          <TableHead>Started</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {params.quests.map((quest) => (
          <TableRow key={quest.id}>
            <TableCell>{quest.user.name}</TableCell>
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
  const visitedHubs = quest.additionalInformation.hubs.filter(
    (x) => x.visited,
  ).length;
  return `${visitedHubs}/${quest.additionalInformation.hubs.length}`;
}
