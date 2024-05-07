"use client";

import { useState } from "react";
import { FaSpinner } from "react-icons/fa";
import { HubsTable } from "~/app/_feature/quest/hubs-table";
import {
  useSearchParamAsDialogState,
  useSearchParamState,
} from "~/app/_feature/url-sync/query";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { toast } from "~/components/ui/use-toast";
import { api } from "~/trpc/react";
import { type RouterOutputs, type RouterInputs } from "~/trpc/shared";

type QuestData = NonNullable<RouterOutputs["quest"]["getCurrentQuestOfPlayer"]>;

export function UserDialog() {
  const [userId, setUserId] = useSearchParamState("userId");
  const [open, setOpen] = useSearchParamAsDialogState(userId, setUserId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {userId && <User params={{ userId }} />}
    </Dialog>
  );
}

function User({
  params,
  onClose,
}: {
  params: { userId: string };
  onClose?: () => void;
}) {
  const { isLoading, data } = api.quest.getCurrentQuestOfPlayer.useQuery({
    userId: params.userId,
  });

  const closeButton = (
    <Button variant="outline" onClick={onClose}>
      Close
    </Button>
  );

  if (isLoading || !data) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Loading...</DialogTitle>
        </DialogHeader>
        <DialogFooter>{closeButton}</DialogFooter>
      </DialogContent>
    );
  }

  const title = `Player ${data.playerName}`;

  return (
    <DialogContent>
      <NoActiveQuest
        params={{ data, title, playerId: params.userId }}
        closeButton={closeButton}
      />
      <HandleQuest
        params={{ data, title, playerId: params.userId }}
        closeButton={closeButton}
      />
      <DoesNotConcernThisHub
        params={{ data, title }}
        closeButton={closeButton}
      />
    </DialogContent>
  );
}

function NoActiveQuest({
  params,
  closeButton,
}: {
  params: { data: QuestData; title: string; playerId: string };
  closeButton: React.ReactNode;
}) {
  type QuestKind = RouterInputs["quest"]["assignQuest"]["questKind"];
  const [questKind, setQuestKind] = useState<string>();
  const { isLoading, mutate } = api.quest.assignQuest.useMutation({
    onSuccess: () =>
      toast({
        title: "Quest assigned",
      }),
    onError: (err) =>
      toast({
        title: `Error assigning quest`,
        description: err.message,
        variant: "destructive",
      }),
  });

  if (params.data.state !== "no-active-quest") return;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{params.title}</DialogTitle>
        <DialogDescription>
          Select which type of quest to assign the player
        </DialogDescription>
      </DialogHeader>
      <RadioGroup value={questKind} onValueChange={setQuestKind}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="walk-1" id="r1" />
          <Label htmlFor="r1">Walking to one hub</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="walk-2" id="r2" />
          <Label htmlFor="r2">Walking to two hubs</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="walk-3" id="r3" />
          <Label htmlFor="r3">Walking to three hubs</Label>
        </div>
      </RadioGroup>
      <DialogFooter className="flex flex-row justify-between">
        {closeButton}
        <Button
          disabled={!questKind}
          onClick={() =>
            mutate({
              playerId: params.playerId,
              questKind: questKind as QuestKind,
            })
          }
        >
          {isLoading ? <FaSpinner className="animate-spin" /> : "Assign Quest"}
        </Button>
      </DialogFooter>
    </>
  );
}

function HandleQuest({
  params,
  closeButton,
}: {
  params: { data: QuestData; title: string; playerId: string };
  closeButton: React.ReactNode;
}) {
  const { isLoading, mutate } = api.quest.markHubAsVisited.useMutation({
    onSuccess: () =>
      toast({
        title: "Hub marked as visited",
      }),
    onError: (err) =>
      toast({
        title: `Error marking hub as visited`,
        description: err.message,
        variant: "destructive",
      }),
  });
  if (params.data.state !== "quest-for-this-hub") return;

  const acceptButton = params.data.currentHubVisited ? (
    <Button disabled>Already visited</Button>
  ) : (
    <Button onClick={() => mutate({ playerId: params.playerId })}>
      {isLoading ? <FaSpinner className="animate-spin" /> : "Mark as visited"}
    </Button>
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>{params.title}</DialogTitle>
        <DialogDescription>
          The player has a quest for this hub
        </DialogDescription>
        <HubsTable hubs={params.data.quest.additionalInformation} />
        <DialogFooter className="flex flex-row justify-between">
          {closeButton}
          {acceptButton}
        </DialogFooter>
      </DialogHeader>
    </>
  );
}

function DoesNotConcernThisHub({
  params,
  closeButton,
}: {
  params: { data: QuestData; title: string };
  closeButton: React.ReactNode;
}) {
  if (params.data.state !== "quest-does-not-concern-this-hub") return;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{params.title}</DialogTitle>
        <DialogDescription>
          The player does not have any business with your hub
        </DialogDescription>
      </DialogHeader>
      <HubsTable hubs={params.data.quest.additionalInformation} />
      <DialogFooter className="flex flex-row justify-between">
        {closeButton}
      </DialogFooter>
    </>
  );
}
