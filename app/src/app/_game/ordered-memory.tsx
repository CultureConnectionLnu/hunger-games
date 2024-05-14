"use client";

import { useState } from "react";
import { useTimers } from "../_feature/timer/timer-provider";
import { GameCard, GameContentLoading } from "./base";
import { CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";

type View =
  | "show-pattern"
  | "input-pattern"
  | "wait-for-opponent"
  | "show-result"
  | "none";

type BoardEntry = {
  col: number;
  row: number;
  number?: number;
  isFail?: boolean;
};

// export default function OrderedMemoryGame({
//   params,
// }: {
//   params: { fightId: string; userId: string };
// }) {
export function OrderedMemoryGame() {
  const { handleEvent } = useTimers();
  const [view, setView] = useState<View>("show-pattern");
  //   const [lastEvent, setLastEvent] = useState<ServerEvent>();

  //   api.rockPaperScissors.onAction.useSubscription(params, {
  //     onData(data) {
  //       switch (data.event) {
  //         case "choose-timer":
  //           return handleEvent(data.event, data.data, "Choose timeout");
  //         case "next-round-timer":
  //           return handleEvent(data.event, data.data, "Next round timeout");
  //         default:
  //           setLastEvent(data);
  //           setView(data.view);
  //       }
  //     },
  //   });

  //   if (!lastEvent) return <GameContentLoading />;
  // return (
  //   <MemoryBoard
  //     params={{
  //       state: "show-pattern",
  //       entries: [
  //         { col: 1, row: 1, number: 1 },
  //         { col: 0, row: 0, isFail: true },
  //         { col: 1, row: 0, isFail: false },
  //       ],
  //     }}
  //     onClick={(args) => console.log(args)}
  //   />
  // );

  return (
    <>
      <ViewContainer
        params={{
          view: view,
        }}
      />
      <Button onClick={() => setView("input-pattern")}>next</Button>
    </>
  );
}

function ViewContainer({
  params,
}: {
  params: {
    view: View;
  };
}) {
  switch (params.view) {
    case "none":
      return <></>;
    case "show-pattern":
      return (
        <MemoryBoard
          params={{
            state: "show-pattern",
            entries: [
              { col: 1, row: 1, number: 1 },
              { col: 0, row: 0, number: 2 },
              { col: 1, row: 0, number: 3 },
            ],
          }}
        />
      );
    case "input-pattern":
      return <MemoryBoard params={{ state: "input-pattern", entries: [] }} />;
    case "wait-for-opponent":
      return <WaitForOpponentToFinishInput />;
    case "show-result":
    //   const { outcome } = params.result!;
    //   const titleMap = {
    //     win: "You won",
    //     draw: "Draw",
    //     loose: "You lost",
    //   } as const;
    //   return (
    //     <ShowResult
    //       params={{
    //         title: titleMap[outcome],
    //         ...params.result!,
    //       }}
    //     />
    //   );
  }
}

function MemoryBoard({
  params,
  onClick,
}: {
  params: {
    state: "show-pattern" | "input-pattern";
    entries: BoardEntry[];
  };
  onClick?: (args: { col: number; row: number }) => void;
}) {
  const rows = 4;
  const columns = 4;

  return (
    <GameCard header={<CardTitle>Remember the pattern</CardTitle>}>
      <div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex">
            {Array.from({ length: columns }).map((_, columnIndex) => (
              <MemoryCell
                key={columnIndex}
                params={{
                  col: columnIndex,
                  row: rowIndex,
                  entries: params.entries,
                }}
                onClick={onClick}
              />
            ))}
          </div>
        ))}
      </div>
    </GameCard>
  );
}

function MemoryCell({
  params,
  onClick,
}: {
  params: {
    col: number;
    row: number;
    entries: BoardEntry[];
  };
  onClick?: (args: { col: number; row: number }) => void;
}) {
  const match = params.entries.find(
    (p) => p.col === params.col && p.row === params.row,
  );
  return (
    // conditionally change color if a number was found to green otherwise keep it at gray
    <div
      className={cn(
        "m-1 flex h-16 w-16 items-center justify-center rounded-sm transition-all duration-300",
        !match ? "bg-gray-200" : match.isFail ? "bg-red-200" : "bg-green-200",
      )}
      onClick={() => onClick?.({ col: params.col, row: params.row })}
    >
      <div className="text-xl">{match?.number}</div>
    </div>
  );
}

function WaitForOpponentToFinishInput() {
  return <GameCard header={<CardTitle>Waiting for opponent</CardTitle>} />;
}

function ShowResult({
  params,
}: {
  params: {
    title: string;
    anotherRound: boolean;
    wins: number;
    looses: number;
    yourName: string;
    opponentName: string;
  };
}) {
  return (
    <GameCard
      header={
        <>
          <CardTitle>{params.title}</CardTitle>
        </>
      }
      footer={params.anotherRound ? "Next round coming up" : undefined}
    >
      <div className="flex w-full justify-between">
        <div>{params.yourName}</div>
        <div>
          {params.wins} - {params.looses}
        </div>
        <div>{params.opponentName}</div>
      </div>
    </GameCard>
  );
}
