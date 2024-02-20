"use client";

import { unstable_noStore as noStore } from "next/cache";
import { useRouter } from "next/navigation";
import { FaSpinner } from "react-icons/fa";
import RockPaperScissorsGame from "~/app/_components/rock-paper-scissors";
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

  if (isLoading) return <FaSpinner className="animate-spin" />;

  if (!data) {
    router.push("/match");
  }

  return <RockPaperScissorsGame params={{ fightId: uuid }} />;
}
