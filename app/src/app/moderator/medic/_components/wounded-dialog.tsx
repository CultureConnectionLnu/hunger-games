"use client";

import { useEffect, useState } from "react";
import { FaSpinner } from "react-icons/fa";
import { useCountdown } from "~/app/_feature/timer/countdown-provider";
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
import { toast } from "~/components/ui/use-toast";
import { api } from "~/trpc/react";
import { type RouterOutputs } from "~/trpc/shared";
import { useWoundedPlayer } from "./wounded-provider";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type WoundedPlayer = UnwrapArray<RouterOutputs["medic"]["getAllWounded"]>;

export function WoundedPlayerDialog() {
  const [userId, setUserId] = useSearchParamState("userId");
  const [open, setOpen] = useSearchParamAsDialogState(userId, setUserId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {userId && (
        <WoundedPlayerDialogContent
          params={{ userId }}
          onClose={() => setUserId(undefined)}
        />
      )}
    </Dialog>
  );
}

function WoundedPlayerDialogContent({
  params,
  onClose,
}: {
  params: { userId: string };
  onClose?: () => void;
}) {
  const { woundedPlayers } = useWoundedPlayer();
  const [player, setPlayer] = useState<WoundedPlayer | undefined>();

  useEffect(() => {
    setPlayer(woundedPlayers.find((player) => player.userId === params.userId));
  }, [setPlayer, woundedPlayers, params.userId]);

  const closeButton = (
    <Button variant="outline" onClick={onClose}>
      Close
    </Button>
  );

  const foundUser = player !== undefined;
  const title = foundUser
    ? `Player ${player.userName}`
    : "Player does not seem to be wounded";

  return (
    <DialogContent>
      {foundUser ? (
        <WoundedPlayer
          params={{
            title,
            player: player,
          }}
          closeButton={closeButton}
          onClose={onClose}
        />
      ) : (
        <NotWoundedPlayer params={{ title }} closeButton={closeButton} />
      )}
    </DialogContent>
  );
}

function NotWoundedPlayer({
  params,
  closeButton,
}: {
  params: {
    title: string;
  };
  closeButton: React.ReactNode;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{params.title}</DialogTitle>
        <DialogDescription>
          {
            "You can't do anything. If this is a bug, then please inform an admin"
          }
        </DialogDescription>
      </DialogHeader>
      <DialogFooter className="flex flex-row justify-between">
        {closeButton}
      </DialogFooter>
    </>
  );
}

function WoundedPlayer({
  params,
  closeButton,
  onClose,
}: {
  params: {
    player: WoundedPlayer;
    title: string;
  };
  closeButton: React.ReactNode;
  onClose?: () => void;
}) {
  const trpcUtils = api.useUtils();
  const startRevive = api.medic.startRevive.useMutation({
    onSuccess: () => {
      toast({
        title: "Start revive",
      });
      void trpcUtils.medic.getAllWounded.invalidate();
      onClose?.();
    },
    onError: (err) =>
      toast({
        title: `Error starting revive`,
        description: err.message,
        variant: "destructive",
      }),
  });
  const finishRevive = api.medic.finishRevive.useMutation({
    onSuccess: () => {
      toast({
        title: "Finish revive",
      });
      void trpcUtils.medic.getAllWounded.invalidate();
      onClose?.();
    },
    onError: (err) =>
      toast({
        title: `Error finish revive`,
        description: err.message,
        variant: "destructive",
      }),
  });
  const { seconds, isDone } = useCountdown(params.player.userId);

  const progress = getProgress(params.player, isDone);

  return (
    <>
      <DialogHeader>
        <DialogTitle>{params.title}</DialogTitle>
        <DialogDescription>
          Select which type of quest to assign the player
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-8">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <Button
              onClick={() =>
                startRevive.mutate({ playerId: params.player.userId })
              }
              disabled={progress !== "wounded"}
            >
              {startRevive.isLoading ? (
                <FaSpinner className="animate-spin" />
              ) : (
                "Start revive"
              )}
            </Button>
          </div>
        </div>
        <div className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <Label>
              {progress === "reviving" ? (isDone ? "✅" : seconds) : "-"}
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Wait for timer to complete before finishing revive is activated
          </p>
        </div>
        <div className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <Button
              onClick={() =>
                finishRevive.mutate({ playerId: params.player.userId })
              }
              disabled={progress !== "wait-finish"}
            >
              {finishRevive.isLoading ? (
                <FaSpinner className="animate-spin" />
              ) : (
                "finish revive"
              )}
            </Button>
          </div>
        </div>
      </div>
      <DialogFooter className="flex flex-row justify-between">
        {closeButton}
      </DialogFooter>
    </>
  );
}
function getProgress(player: WoundedPlayer, isDone: boolean) {
  if (player.isWounded && player.initialTimeoutInSeconds === undefined) {
    return "wounded" as const;
  }
  if (player.initialTimeoutInSeconds === 0 || isDone) {
    return "wait-finish" as const;
  }
  return "reviving" as const;
}
