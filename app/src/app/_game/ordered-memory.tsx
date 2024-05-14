"use client";

import { useState } from "react";
import { useTimers } from "../_feature/timer/timer-provider";
import { GameCard, GameContentLoading } from "./base";
import { CardTitle } from "~/components/ui/card";

type View =
  | "show-pattern"
  | "input-pattern"
  | "wait-for-opponent"
  | "show-result"
  | "none";

// export default function OrderedMemoryGame({
//   params,
// }: {
//   params: { fightId: string; userId: string };
// }) {
export function OrderedMemoryGame() {
  const { handleEvent } = useTimers();
  const [view, setView] = useState<View>("none");
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
  return (
    <MemoryBoard
      params={{
        state: "show-pattern",
        pattern: [{ col: 1, row: 1, number: 1 }],
      }}
      onClick={(args) => console.log(args)}
    />
  );

  return (
    <ViewContainer
      params={{
        view: view,
      }}
    />
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
    case "input-pattern":
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
    pattern: { col: number; row: number; number: number }[];
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
              <div
                key={columnIndex}
                className="m-1 flex h-16 w-16 items-center justify-center rounded-sm bg-gray-200"
                onClick={() => onClick?.({ col: columnIndex, row: rowIndex })}
              >
                <MemoryCell
                  params={{
                    col: columnIndex,
                    row: rowIndex,
                    number: getNumberAtPosition(
                      params.pattern,
                      columnIndex,
                      rowIndex,
                    ),
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </GameCard>
  );
}

function MemoryCell({
  params,
}: {
  params: { col: number; row: number; number?: number };
}) {
  return <div className="text-xl">{params.number}</div>;
}

function getNumberAtPosition(
  pattern: { col: number; row: number; number: number }[],
  col: number,
  row: number,
) {
  return pattern.find((p) => p.col === col && p.row === row)?.number;
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
