"use client";

import { useState } from "react";
import { FaSpinner } from "react-icons/fa";
import { HubsTable } from "~/app/_feature/quest/hubs-table";
import { Button } from "~/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { toast } from "~/components/ui/use-toast";
import { api } from "~/trpc/react";
import { type RouterInputs, type RouterOutputs } from "~/trpc/shared";

type QuestData = NonNullable<RouterOutputs["quest"]["getCurrentQuestOfPlayer"]>;

export function QuestRelatedContent({
  params,
  onClose,
}: {
  params: { userId: string };
  onClose?: () => void;
}) {
  const { isLoading, data } = api.quest.getCurrentQuestOfPlayer.useQuery({
    userId: params.userId,
  });

  const trpcUtils = api.useUtils();

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
  const title = `Player ${data.playerName}`;
  function invalidateCurrentQuest() {
    void trpcUtils.quest.getCurrentQuestOfPlayer.invalidate({
      userId: params.userId,
    });
  }

  return (
    <>
      <NoActiveQuest
        params={{
          data,
          title,
          playerId: params.userId,
          onComplete: invalidateCurrentQuest,
        }}
        closeButton={closeButton}
      />
      <HandleQuest
        params={{
          data,
          title,
          playerId: params.userId,
          onComplete: invalidateCurrentQuest,
        }}
        closeButton={closeButton}
      />
      <DoesNotConcernThisHub
        params={{ data, title }}
        closeButton={closeButton}
      />
      <NoPlayer params={{ data, title }} closeButton={closeButton} />
      <PlayerWounded params={{ data, title }} closeButton={closeButton} />
      <PlayerInAFight params={{ data, title }} closeButton={closeButton} />
    </>
  );
}

function NoActiveQuest({
  params,
  closeButton,
}: {
  params: {
    data: QuestData;
    title: string;
    playerId: string;
    onComplete?: () => void;
  };
  closeButton: React.ReactNode;
}) {
  type QuestKind = RouterInputs["quest"]["assignQuest"]["questKind"];
  const [questKind, setQuestKind] = useState<string>();
  const { isLoading, mutate } = api.quest.assignQuest.useMutation({
    onSuccess: () => {
      toast({
        title: "Quest assigned",
      });
      params.onComplete?.();
    },
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
  params: {
    data: QuestData;
    title: string;
    playerId: string;
    onComplete?: () => void;
  };
  closeButton: React.ReactNode;
}) {
  const { isLoading, mutate } = api.quest.markHubAsVisited.useMutation({
    onSuccess: () => {
      toast({
        title: "Hub marked as visited",
      });
      params.onComplete?.();
    },
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

function NoPlayer({
  params,
  closeButton,
}: {
  params: { data: QuestData; title: string };
  closeButton: React.ReactNode;
}) {
  if (params.data.state !== "is-no-player") return;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{params.title}</DialogTitle>
        <DialogDescription>
          The selected user is no player. Please forward the user to an admin so
          that he can be registered.
        </DialogDescription>
        <DialogFooter className="flex flex-row justify-between">
          {closeButton}
        </DialogFooter>
      </DialogHeader>
    </>
  );
}

function PlayerWounded({
  params,
  closeButton,
}: {
  params: { data: QuestData; title: string };
  closeButton: React.ReactNode;
}) {
  if (params.data.state !== "player-is-wounded") return;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{params.title}</DialogTitle>
        <DialogDescription>
          The selected player is wounded. Please forward the player to the next
          medic.
        </DialogDescription>
        <DialogFooter className="flex flex-row justify-between">
          {closeButton}
        </DialogFooter>
      </DialogHeader>
    </>
  );
}

function PlayerInAFight({
  params,
  closeButton,
}: {
  params: { data: QuestData; title: string };
  closeButton: React.ReactNode;
}) {
  if (params.data.state !== "player-in-fight") return;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{params.title}</DialogTitle>
        <DialogDescription>
          The selected player is fighting right now. While a player is in a
          fight, no quest activity can happen.
        </DialogDescription>
        <DialogFooter className="flex flex-row justify-between">
          {closeButton}
        </DialogFooter>
      </DialogHeader>
    </>
  );
}
