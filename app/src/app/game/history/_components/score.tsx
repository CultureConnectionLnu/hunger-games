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
type ScoreEntry = UnwrapArray<RouterOutputs["score"]["getHistory"]>;

export function ScoreTable({
  params,
}: {
  params: {
    scores: ScoreEntry[];
  };
}) {
  const questId = useQueryParamMutation("questId");
  const fightId = useQueryParamMutation("fightId");

  const scores = params.scores.map((x) => ({
    id: (x.questId ?? x.fightId)!,
    type: x.questId !== undefined ? "quest" : "fight",
    scoreChange: x.scoreChange,
    score: x.score,
  }));
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
        {scores.map((entry) => (
          <TableRow
            key={entry.id}
            onClick={() =>
              entry.type === "quest" ? questId(entry.id) : fightId(entry.id)
            }
          >
            <TableCell>{entry.type === "quest" ? "Quest" : "Fight"}</TableCell>
            <TableCell>{entry.scoreChange}</TableCell>
            <TableCell>{entry.score}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
