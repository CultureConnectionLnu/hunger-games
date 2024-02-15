import { redirect } from "next/navigation";
import { api } from "~/trpc/server";
import { slugToUuid } from "~/lib/slug";

export default async function MatchPage({
  params,
}: {
  params: { slug: string };
}) {
  const uuid = slugToUuid(params.slug);
  if (!await api.match.exists.query({ id: uuid })){
    redirect("/match");
  }

  return (
    <div>
      <h1>Match Page</h1>
      {params.slug}
    </div>
  );
}