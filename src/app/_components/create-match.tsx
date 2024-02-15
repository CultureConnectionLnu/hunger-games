"use client";

import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { uuidToSlug } from "~/lib/slug";

export function CreateMatch() {
  const router = useRouter();
  const createMatch = api.match.create.useMutation({
    onSuccess: ({ id }) => router.push(`/match/${uuidToSlug(id)}`),
  });
  return <Button onClick={() => createMatch.mutate()}>enter match</Button>;
}
