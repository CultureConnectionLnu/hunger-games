"use client";

import { unstable_noStore as noStore } from "next/cache";
import { useRouter } from "next/navigation";
import { slugToUuid } from "~/lib/slug";
import { api } from "~/trpc/react";

export default function RockPaperScissors({
  params,
}: {
  params: { slug: string };
}) {
  noStore();

  const router = useRouter();
  const uuid = slugToUuid(params.slug);
  const { data, isLoading } = api.fight.canJoin.useQuery({ id: uuid });
  if (isLoading) return <div>Loading...</div>;
  if (!data) {
    router.push("/match");
  }

  return (
    <div>
      <h1>Rock Paper Scissors</h1>
    </div>
  );
}
