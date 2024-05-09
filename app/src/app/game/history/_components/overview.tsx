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

export function OverviewTable({
  params,
}: {
  params: {
    entries: {
      type: "quest" | "fight";
      id: string;
      change: number;
      score: number;
    }[];
  };
}) {
  const questId = useQueryParamMutation("questId");
  const fightId = useQueryParamMutation("fightId");
  return (
    <Table>
      <TableCaption>Your Score History</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Change</TableHead>
          <TableHead>Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {params.entries.map((entry) => (
          <TableRow
            key={entry.id}
            onClick={() =>
              entry.type === "quest" ? questId(entry.id) : fightId(entry.id)
            }
          >
            <TableCell>{entry.type === "quest" ? "Quest" : "Fight"}</TableCell>
            <TableCell>{entry.change}</TableCell>
            <TableCell>{entry.score}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
