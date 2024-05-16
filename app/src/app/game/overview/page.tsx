"use client";
import { useEffect, useState } from "react";
import { useSearchParamState } from "~/app/_feature/url-sync/query";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { toast } from "~/components/ui/use-toast";
import { env } from "~/env";
import { api } from "~/trpc/react";
import { QrCode } from "../../_feature/qrcode/qr-code-visualizer";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { NoQuest } from "../quest/_components/no-quest";
import { kindToText } from "../quest/_components/walk-quest";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

export default function PlayerOverview() {
  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 pb-4">
        <JoinGame />
        <div className="flex flex-col gap-4 px-4">
          <Score />
          <Quest />
          <Loaderboard />
        </div>
      </div>
    </ScrollArea>
  );
}

function Loaderboard() {
  const { userId } = useAuth();
  const { data, isLoading } = api.score.dashboard.useQuery();
  const [position, setPosition] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (isLoading || !data) return;
    setPosition(data.find((item) => item.userId === userId)?.rank);
  }, [data, isLoading, userId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isLoading ? <Skeleton className="h-4 w-[300px]" /> : position ?? "-"}
        </CardTitle>
        <CardDescription>Your position in the Leaderboard</CardDescription>
      </CardHeader>
      <CardFooter className="flex-row-reverse">
        <Link href="/dashboard">
          <Button variant="outline">Show Leaderboard</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function Quest() {
  const { data, isLoading } = api.quest.getCurrentQuestForPlayer.useQuery();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-4 w-[300px]" />
          </CardTitle>
          <CardDescription>You current Quest</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data) {
    return <NoQuest />;
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>Walk Quest with {kindToText(data.kind)}</CardTitle>
        <CardDescription>
          To complete this quest, you need to visit the listed hubs.
        </CardDescription>
      </CardHeader>
      <CardFooter className="flex-row-reverse">
        <Link href="/game/quest">
          <Button variant="outline">Show quest details</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function Score() {
  const { data, isLoading } = api.score.getCurrentScore.useQuery();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isLoading || data === undefined ? (
            <Skeleton className="h-4 w-[300px]" />
          ) : (
            data
          )}
        </CardTitle>
        <CardDescription>You current Score</CardDescription>
      </CardHeader>
      <CardFooter className="flex-row-reverse">
        <Link href="/game/history">
          <Button variant="outline">Show score details</Button>
        </Link>
      </CardFooter>
    </Card>
  );
}

function JoinGame() {
  const [opponent, setOpponent] = useSearchParamState("userId");
  const createMatch = api.lobby.create.useMutation({
    onError: (error) => {
      setOpponent(undefined);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 5000,
      });
    },
  });

  useEffect(() => {
    if (createMatch.isLoading) return;
    if (opponent) {
      createMatch.mutate({ opponent });
      setOpponent(undefined);
    }
  }, [opponent, setOpponent, createMatch]);
  return (
    <div>
      <QrCode
        route="/game/overview"
        text="When the opponent scans this QR code with his phone, then you start a match."
      />
      {env.NEXT_PUBLIC_FEATURE_MANUAL_JOIN === "true" ? (
        <StartMatch opponent={opponent} setOpponent={setOpponent} />
      ) : (
        <></>
      )}
    </div>
  );
}

function StartMatch({
  opponent,
  setOpponent,
}: {
  opponent?: string;
  setOpponent?: (value: string) => void;
}) {
  const [newOpponent, setNewOpponent] = useState(opponent ?? "");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setOpponent?.(newOpponent);
      }}
      className="flex flex-col gap-2"
    >
      <input
        type="text"
        placeholder="Opponent id"
        value={opponent}
        onChange={(e) => setNewOpponent(e.target.value)}
        className="w-full rounded-full px-4 py-2 text-black"
      />
      <Button type="submit">enter match</Button>
    </form>
  );
}
