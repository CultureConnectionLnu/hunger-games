"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { FaGamepad, FaSpinner } from "react-icons/fa";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { api } from "~/trpc/react";
import LoadingScreen from "../_components/util/loading-spinner";
import { useTimers } from "../_context/timer";
import type { RouterOutputs } from "~/trpc/shared";
import type { Observable } from "@trpc/server/observable";
import { useEffect, useState } from "react";
import { Timer } from "../_components/util/timer";
import RockPaperScissorsGame from "../_components/games/rock-paper-scissors";

type ServerEvent =
  RouterOutputs["fight"]["onAction"] extends Observable<infer R, never>
    ? R
    : never;

type GetWinnerEvent<T> = T extends { event: "game-ended" } ? T : never;
type WinnerEvent = GetWinnerEvent<ServerEvent>;

export default function CurrentGame() {
  const { user } = useUser();
  const { isLoading: timerLoading, updateTimer } = useTimers();
  const [currentFight, setCurrentFight] = useState<
    RouterOutputs["fight"]["currentFight"] | undefined
  >(undefined);

  useEffect(() => {
    const { data, isLoading } = api.fight.currentFight.useQuery();
    if (!isLoading) {
      setCurrentFight(data);
    }
  }, []);

  if (currentFight === undefined || timerLoading) {
    return <LoadingScreen params={{ title: "Loading fight" }} />;
  }

  if (currentFight.success === false || user == null) {
    return <NoFightOngoing />;
  }

  return (
    <JoiningGame
      params={{
        gameName: currentFight.fight.game,
        fightId: currentFight.fight.fightId,
        updateTimer,
        userId: user.id,
      }}
    />
  );
}

function JoiningGame({
  params,
}: {
  params: {
    gameName: string;
    fightId: string;
    userId: string;
    updateTimer: (label: string, secondsLeft: number) => void;
  };
}) {
  const [joining, setJoining] = useState(true);
  useEffect(() => {
    const { isLoading } = api.fight.join.useQuery();
    setJoining(isLoading);
  }, []);

  if (joining) {
    return <LoadingScreen params={{ title: "Joining Game" }} />;
  }

  return <GameLobby params={params} />;
}

function GameLobby({
  params,
}: {
  params: {
    gameName: string;
    fightId: string;
    userId: string;
    updateTimer: (label: string, secondsLeft: number) => void;
  };
}) {
  const [lastEvent, setLastEvent] = useState<ServerEvent>();
  api.fight.onAction.useSubscription(params, {
    onData(data) {
      switch (data.event) {
        case "start-timer":
        case "disconnect-timer":
          params.updateTimer(data.event, data.data.secondsLeft);
          break;
        default:
          setLastEvent(data);
      }
    },
  });

  if (!lastEvent) {
    return <LoadingScreen params={{ title: "Joining Game" }} />;
  }

  // Render Lobby
  switch (lastEvent.view.general) {
    case "none":
      return <LoadingScreen params={{ title: "Joining" }} />;
    case "joined":
      return <ReadyScreen params={params} />;
    case "ready":
      return <WaitForOtherPlayer />;
    case "game-ended":
      const data = lastEvent.data as WinnerEvent["data"];
      return <EndScreen params={{ ...data, you: params.userId }} />;
    // todo: add game-halted view
  }

  // Render Game
  switch (params.gameName) {
    case "rock-paper-scissors":
      return <RockPaperScissorsGame params={params} />;
    default:
      return `Selected game is not implemented: ${params.gameName}`;
  }
}

function NoFightOngoing() {
  return (
    <Card className="mx-auto max-w-sm">
      <CardHeader className="flex flex-col items-center gap-2">
        <div>
          <FaGamepad />
          <span className="sr-only">No item found</span>
        </div>
        <CardTitle>No ongoing fight</CardTitle>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Link className="mx-auto" href="/match">
          <Button variant="outline">Return to QrCode</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function ReadyScreen({ params }: { params: { gameName: string } }) {
  const ready = api.fight.ready.useMutation();
  return (
    <Card className="flex h-screen flex-col items-center justify-center p-4 md:p-6">
      <CardContent className="space-y-4 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{params.gameName}</h1>
        </div>
        <div className="space-y-2">
          <Button onClick={() => ready.mutate()}>
            Ready{" "}
            {ready.isLoading ? <FaSpinner className="animate-spin" /> : <></>}
          </Button>
        </div>
        <div className="flex flex-col items-center space-y-2 text-center">
          <Timer params={{ id: "start-timer", label: "Game start timeout" }} />
        </div>
      </CardContent>
    </Card>
  );
}

function WaitForOtherPlayer() {
  return (
    <Card className="flex h-screen flex-col items-center justify-center p-4 md:p-6">
      <CardContent className="space-y-4 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Bumper Cars</h1>
        </div>
        <div className="space-y-2"></div>
        <div className="flex flex-col items-center space-y-2 text-center">
          <Timer params={{ id: "start-timer", label: "Game start timeout" }} />
        </div>
      </CardContent>
    </Card>
  );
}

function EndScreen({
  params,
}: {
  params: { winnerId: string; looserId: string; you: string };
}) {
  const { data: winnerName, isLoading: winnerLoading } =
    api.user.getUserName.useQuery({ id: params.winnerId });
  const { data: looserName, isLoading: looserLoading } =
    api.user.getUserName.useQuery({ id: params.looserId });

  if (winnerLoading || looserLoading) {
    return <LoadingScreen params={{ title: "Processing Results" }} />;
  }

  return (
    <Card className="mx-auto max-w-sm">
      <CardContent className="grid items-center justify-center gap-6 px-4 pb-6 md:px-6">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl">
            Game Over
          </h1>
          <p className="text-gray-500 dark:text-gray-400 md:text-xl/relaxed lg:text-base/relaxed">
            The game has ended. Here are the results.
          </p>
        </div>
        <div className="grid w-full max-w-sm gap-2">
          <div
            className={
              "grid grid-cols-2 items-center gap-2" + params.winnerId ===
              params.you
                ? " bg-green-100"
                : ""
            }
          >
            <div className="flex items-center gap-2">
              <div className="grid gap-0.5">
                <p className="text-sm font-medium">Player 1</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {winnerName}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <div className="grid gap-0.5">
                <p className="text-right text-sm font-medium text-green-500">
                  Winner
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  +10 XP
                  {/* todo: calculate points */}
                </p>
              </div>
            </div>
          </div>
          <div
            className={
              "grid grid-cols-2 items-center gap-2" + params.looserId ===
              params.you
                ? " bg-red-100"
                : ""
            }
          >
            <div className="flex items-center gap-2">
              <div className="grid gap-0.5">
                <p className="text-sm font-medium">Player 2</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {looserName}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <div className="grid gap-0.5">
                <p className="text-right text-sm font-medium">Loser</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  -5 XP
                  {/* todo: calculate points */}
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
