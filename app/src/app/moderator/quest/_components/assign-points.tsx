import { useRef } from "react";
import { Button } from "~/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { api } from "~/trpc/react";

const buttonValues = [100, 200, 300];

export function AssignPoints({
  params,
  onClose,
}: {
  params: { userId: string };
  onClose?: () => void;
}) {
  const { data, isLoading } = api.user.nameOfPlayer.useQuery({
    id: params.userId,
  });
  const inputRef = useRef<HTMLInputElement>();

  const closeButton = (
    <Button variant="outline" onClick={onClose}>
      Close
    </Button>
  );

  if (isLoading || !data) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Loading...</DialogTitle>
        </DialogHeader>
        <DialogFooter>{closeButton}</DialogFooter>
      </>
    );
  }
  return (
    <>
      <DialogHeader>
        <DialogTitle>Assign points to player {data}</DialogTitle>
        <DialogDescription>
          This should be used for the quests that are completed at the hub
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-2 py-6">
        <div className="flex justify-between px-10">
          {buttonValues.map((value) => (
            <Button
              key={value}
              onClick={() => {
                if (!inputRef.current) return;
                inputRef.current.value = String(value);
              }}
            >
              {value}
            </Button>
          ))}
        </div>
        <div className="px-10">
          <Input ref={inputRef} placeholder="Custom points" type="number" />
        </div>
      </div>
      <DialogFooter className="flex flex-row justify-between">
        <Button>Assign</Button>
        {closeButton}
      </DialogFooter>
    </>
  );
}
