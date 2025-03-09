"use client";
import { ScrollArea } from "@radix-ui/react-scroll-area";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef } from "react";
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
import { api } from "~/server/api";
import { QrCode } from "../../_feature/qrcode/qr-code-visualizer";
import { NoQuest } from "../quest/_components/no-quest";
// the import in dev mode is wrong if not for this * import
import * as env from "~/env";
import { useRouter } from "next/navigation";
import { extractUserIdFromUrl } from "~/app/_feature/qrcode/qr-code-scanner";

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
  const isLoading = true;
  const position = undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isLoading ? (
            <Skeleton className="h-4 w-[300px]" />
          ) : (
            (position ?? "-")
          )}
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
  const isLoading = true;
  const data = undefined;

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
  // return (
  //   <Card>
  //     <CardHeader>
  //       <CardTitle>Walk Quest with {kindToText(data.kind)}</CardTitle>
  //       <CardDescription>
  //         To complete this quest, you need to visit the listed hubs.
  //       </CardDescription>
  //     </CardHeader>
  //     <CardFooter className="flex-row-reverse">
  //       <Link href="/game/quest">
  //         <Button variant="outline">Show quest details</Button>
  //       </Link>
  //     </CardFooter>
  //   </Card>
  // );
}

function Score() {
  const isLoading = true;
  const data = undefined;
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
  useStartMatch();

  return (
    <div>
      <QrCode
        route="/game/overview"
        text="When the opponent scans this QR code with his phone, then you start a match."
      />

      {env.env.NEXT_PUBLIC_NODE_ENV === "development" && <ManualInput />}
    </div>
  );
}

function useStartMatch() {
  const [opponent, setOpponent] = useSearchParamState("userId");

  const startMatch = useMutation({
    mutationFn: (opponentId: string) => api.game.startGame({ opponentId }),
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
    if (startMatch.isPending) return;
    if (opponent) {
      startMatch.mutate(opponent);
      setOpponent(undefined);
    }
    // No need to rerender for the set function
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponent, startMatch.isPending]);
}

function ManualInput() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <p>
        If you want to test the app without scanning a QR code, you can enter a
        user ID manually.
      </p>
      <input
        ref={ref}
        type="text"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const userId = extractUserIdFromUrl(ref.current?.value ?? "");
            if (!userId) return;
            router.push(`/game/overview?userId=${userId}`);
          }
        }}
      />
    </div>
  );
}
