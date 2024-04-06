"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { FaGamepad, FaSpinner } from "react-icons/fa";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { api } from "~/trpc/react";
import LoadingScreen from "../_components/util/loading-spinner";
import { useTimers } from "../_context/timer";
import type { RouterOutputs } from "~/trpc/shared";
import type { Observable } from "@trpc/server/observable";
import React, { useState } from "react";
import { Timer } from "../_components/util/timer";
import RockPaperScissorsGame from "../_components/games/rock-paper-scissors";
import { Skeleton } from "~/components/ui/skeleton";
import { RxCross2 } from "react-icons/rx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { useRouter } from "next/navigation";

type ServerEvent =
  RouterOutputs["fight"]["onAction"] extends Observable<infer R, never>
    ? R
    : never;

type GetWinnerEvent<T> = T extends { event: "game-ended" } ? T : never;
type WinnerEvent = GetWinnerEvent<ServerEvent>;

export default function CurrentGame() {
  const { user, isLoaded: userLoaded } = useUser();
  const { isLoading: timerLoading, updateTimer } = useTimers();

  const { data: currentFight, isLoading: currentFightLoading } =
    api.fight.currentFight.useQuery(undefined, {
      staleTime: Infinity,
      refetchOnMount: "always",
    });

  if (currentFightLoading || timerLoading || !userLoaded) {
    return <GameLoadingScreen />;
  }

  if (currentFight!.success === false || user == null) {
    return <NoFightOngoing />;
  }

  return (
    <JoiningGame
      params={{
        gameName: currentFight!.fight.game,
        fightId: currentFight!.fight.fightId,
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
  const { isLoading: joining } = api.fight.join.useQuery(undefined, {
    staleTime: Infinity,
    refetchOnMount: "always",
  });
  if (joining) {
    return <GameLoadingScreen />;
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
    return <GameLoadingScreen />;
  }
  console.log(lastEvent);

  // Render Lobby
  let lobby: React.ReactNode | undefined = undefined;
  switch (lastEvent.view.general) {
    case "none":
      lobby = <LoadingScreen params={{ title: "Joining" }} />;
      break;
    case "joined":
      lobby = <ReadyScreen params={params} />;
      break;
    case "ready":
      lobby = <WaitForOtherPlayer params={params} />;
      break;
    case "game-ended":
      const data = lastEvent.data as WinnerEvent["data"];
      lobby = <EndScreen params={{ ...data, you: params.userId }} />;
      break;
    // todo: add game-halted view
  }

  if (lobby !== undefined) {
    return (
      <GameContainer header={getReadableGameName(params.gameName)}>
        {lobby}
      </GameContainer>
    );
  }

  // Render Game
  let game: React.ReactNode | undefined = undefined;
  switch (params.gameName) {
    case "rock-paper-scissors":
      game = <RockPaperScissorsGame params={params} />;
      break;
    default:
      return `Selected game is not implemented: ${params.gameName}`;
  }

  if (game !== undefined) {
    return (
      <GameContainer header={getReadableGameName(params.gameName)}>
        {game}
      </GameContainer>
    );
  }

  // This should only happen in an error case
  return (
    <GameContainer header={"Game not implemented"}>
      The game {params.gameName} has no implementation
    </GameContainer>
  );
}

function getReadableGameName(gameName: string) {
  switch (gameName) {
    case "rock-paper-scissors":
      return "Rock Paper Scissors";
    default:
      return "No Game";
  }
}

function GameContainer({
  param,
  header,
  children,
}: {
  children: React.ReactNode;
  header: React.ReactNode;
  param?: {
    noGameRunning?: boolean;
  };
}) {
  const router = useRouter();
  const alertLeave = (
    <AlertDialog>
      <AlertDialogTrigger>
        <RxCross2 />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>You are about to leave the game</AlertDialogTitle>
          <AlertDialogDescription>
            By leaving you will lose the game.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push("/qr-code")}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogHeader>
      </AlertDialogContent>
    </AlertDialog>
  );
  const leave = (
    <Link href="/qr-code">
      <RxCross2 />
    </Link>
  );
  return (
    <>
      <header className="flex h-14 w-full items-center justify-between px-4">
        <div>{/* empty so that the next element is in the center */}</div>
        {header}
        {param?.noGameRunning ?? true ? leave : alertLeave}
      </header>
      <main
        className="flex flex-col justify-center px-4"
        style={{
          height: "calc(100vh - 56px)",
        }}
      >
        {children}
      </main>
    </>
  );
}

function GameLoadingScreen() {
  return (
    <GameContainer header={<Skeleton className="h-4 w-1/2" />}>
      <Card>
        <CardHeader className="flex items-center justify-center space-x-4">
          <Skeleton className="h-8 w-3/4" />
        </CardHeader>
        <CardContent className="flex items-center justify-center p-8">
          <div className="space-y-4 text-center">
            <Skeleton className="h-4 w-[300px]" />
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </CardContent>
      </Card>
    </GameContainer>
  );
}

function NoFightOngoing() {
  return (
    <GameContainer header={"No game"} param={{ noGameRunning: true }}>
      <Card>
        <CardHeader className="flex items-center justify-center space-x-4">
          <CardTitle className="flex gap-4">
            <FaGamepad />
            No ongoing game
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-8">
          <Link className="mx-auto" href="/qr-code">
            <Button variant="outline">Return to QrCode</Button>
          </Link>
        </CardContent>
      </Card>
    </GameContainer>
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

function WaitForOtherPlayer({ params }: { params: { gameName: string } }) {
  return (
    <Card className="flex h-screen flex-col items-center justify-center p-4 md:p-6">
      <CardContent className="space-y-4 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{params.gameName}</h1>
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
    <div>
      <Link className="mx-auto" href="/match">
        <Button variant="outline">Return to QrCode</Button>
      </Link>
      <Card className="mx-auto max-w-sm">
        <CardHeader>
          <CardTitle>Game Over</CardTitle>
          <CardDescription>
            The game has ended. Here are the results.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid items-center justify-center gap-6 px-4 pb-6 md:px-6">
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
    </div>
  );
}
