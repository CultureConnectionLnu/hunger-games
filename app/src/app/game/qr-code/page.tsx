"use client";
import { useSearchParams } from "next/navigation";
import { QrCode } from "../../_feature/qrcode/qr-code-visualizer";
import { useState } from "react";
import { api } from "~/trpc/react";
import { FaSpinner } from "react-icons/fa";
import { Button } from "~/components/ui/button";
import { env } from "~/env";

export default function MatchOverviewPage() {
  const searchParams = useSearchParams();
  const createMatch = api.lobby.create.useMutation();
  const userId = searchParams.get("userId");

  if (userId && !createMatch.isLoading) {
    createMatch.mutate({ opponent: userId });
  }

  return (
    <div>
      <QrCode route="/qr-code" />
      {env.NEXT_PUBLIC_FEATURE_MANUAL_JOIN === "true" ? <StartMatch /> : <></>}
    </div>
  );
}

function StartMatch() {
  const searchParams = useSearchParams();
  const [opponent, setOpponent] = useState(searchParams.get("userId") ?? "");
  const createMatch = api.lobby.create.useMutation();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        createMatch.mutate({ opponent });
      }}
      className="flex flex-col gap-2"
    >
      <input
        type="text"
        placeholder="Opponent id"
        value={opponent}
        onChange={(e) => setOpponent(e.target.value)}
        className="w-full rounded-full px-4 py-2 text-black"
      />
      {createMatch.isLoading ? (
        <FaSpinner className="animate-spin" />
      ) : (
        <Button type="submit">enter match</Button>
      )}
    </form>
  );
}
