"use client";
import { useState } from "react";
import { useSearchParamState } from "~/app/_feature/url-sync/query";
import { Button } from "~/components/ui/button";
import { toast } from "~/components/ui/use-toast";
import { env } from "~/env";
import { api } from "~/trpc/react";
import { QrCode } from "../../_feature/qrcode/qr-code-visualizer";

export default function MatchOverviewPage() {
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

  if (opponent && !createMatch.isLoading) {
    createMatch.mutate({ opponent });
  }

  return (
    <div>
      <QrCode route="/qr-code" />
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
