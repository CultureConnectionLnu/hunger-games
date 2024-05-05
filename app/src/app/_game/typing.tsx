import { type Observable } from "@trpc/server/observable";
import { useState } from "react";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react"
import { type RouterOutputs } from "~/trpc/shared";

type ServerEvent =
  RouterOutputs["typing"]["onAction"] extends Observable<
    infer R,
    never
  >
    ? R
    : never;

export default function TypingGame({
  params,
}: {
  params: { fightId: string; userId: string };
}) {

  const [lastEvent, setLastEvent] = useState<ServerEvent>();
  const typingCharacterInput = api.typing.typingCharacterInput.useMutation();

  api.typing.onAction.useSubscription(params, {
    onData: (data) => {
      setLastEvent(data)
    }
  })

  return <div>
    <Input type="text" onKeyDown={(e) => {
      typingCharacterInput.mutate({char: e.key})
    }}/>
    <p>{lastEvent?.event==="type-character" && lastEvent.data?.character}</p>
  </div>;
}
