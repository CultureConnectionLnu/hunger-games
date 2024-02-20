import { useUser } from "@clerk/nextjs";
import { FaSpinner } from "react-icons/fa";
import { api } from "~/trpc/react";

export default function RockPaperScissorsGame({
  params,
}: {
  params: { fightId: string };
}) {
  const { user } = useUser();
  api.rockPaperScissors.onAction.useSubscription(
    { fightId: params.fightId, userId: user?.id ?? "" },
    {
      onData(data) {
        console.log(data);
      },
      enabled: Boolean(user),
    },
  );
  const { isLoading: joining } = api.rockPaperScissors.join.useQuery();
    const ready = api.rockPaperScissors.ready.useMutation();
    const choose = api.rockPaperScissors.choose.useMutation();

  if (joining)
    return (
      <p>
        Joining
        <FaSpinner className="animate-spin" />
      </p>
    );

  return (
    <div>
      <h1>Rock Paper Scissors</h1>
    </div>
  );
}
