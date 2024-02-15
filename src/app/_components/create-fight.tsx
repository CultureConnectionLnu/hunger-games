"use client";

import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { uuidToSlug } from "~/lib/slug";

import { FaSpinner } from "react-icons/fa";
import { useState } from "react";

export function CreateFight() {
  const [opponent, setOpponent] = useState("");
  const router = useRouter();
  const createMatch = api.fight.create.useMutation({
    onSuccess: ({ id }) => router.push(`/match/${uuidToSlug(id)}`),
  });
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
