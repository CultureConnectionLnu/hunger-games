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
type FightEntry = UnwrapArray<RouterOutputs["lobby"]["getAllMyFights"]>;
type ScoreEntry = UnwrapArray<RouterOutputs["score"]["getHistory"]>;

const gameNameMap = {
  "rock-paper-scissors": "Rock Paper Scissors",
  "ordered-memory": "Ordered Memory",
} satisfies Record<FightEntry["game"], string>;

export function FightHistory({
  params,
}: {
  params: { fights: FightEntry[]; scores: ScoreEntry[] };
}) {
  const fightId = useQueryParamMutation("fightId");

  const fights = params.fights.map((x) => {
    const scoreEntry = params.scores.find((s) => s.fightId === x.fightId);
    return {
      ...x,
      scoreEntry,
    };
  });

  return (
    <Table>
      <TableCaption>Your Fight History</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Game</TableHead>
          <TableHead>Result</TableHead>
          <TableHead className="text-right">Change/Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {fights.map((fight) => (
          <TableRow key={fight.fightId} onClick={() => fightId(fight.fightId)}>
            <TableCell>{gameNameMap[fight.game]}</TableCell>
            <TableCell>
              {fight.abandoned ? "Abandoned" : fight.youWon ? "Win" : "Loose"}
            </TableCell>
            <TableCell className="text-right">
              {fight.scoreEntry
                ? `${fight.scoreEntry.scoreChange}/${fight.scoreEntry.score}`
                : `-`}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
