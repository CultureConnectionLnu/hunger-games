import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";
import { Button } from "~/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "~/components/ui/use-toast";
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
  const [value, setValue] = useState<number>(0);

  const assignPoints = api.quest.assignPoints.useMutation({
    onSuccess: () =>
      toast({
        title: "Successfully assigned points to player",
      }),
    onError: (error) =>
      toast({
        title: "Failed to assign points to player",
        description: error.message,
        variant: "destructive",
      }),
  });

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
                setValue(value);
              }}
            >
              {value}
            </Button>
          ))}
        </div>
        <div className="px-10">
          <Input
            placeholder="Custom points"
            type="number"
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
          />
        </div>
      </div>
      <DialogFooter className="flex flex-row justify-between">
        <AssignConformation
          params={{ value }}
          onClick={(x) =>
            assignPoints.mutate({ playerId: params.userId, points: x })
          }
        />
        {closeButton}
      </DialogFooter>
    </>
  );
}

function AssignConformation({
  params,
  onClick,
}: {
  params: { value: number };
  onClick: (value: number) => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button disabled={params.value === 0}>Assign</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Did you select the correct score?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently assign the
            points!
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="text-center">
          <Label className="text-2xl font-extrabold">{params.value}</Label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => onClick(Number(params.value))}>
            Assign
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
