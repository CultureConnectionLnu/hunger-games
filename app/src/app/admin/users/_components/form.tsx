"use client";

import { useEffect, useState } from "react";
import { Button } from "~/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Switch } from "~/components/ui/switch";
import { toast } from "~/components/ui/use-toast";
import { api } from "~/trpc/react";
import type { RouterInputs, RouterOutputs } from "~/trpc/shared";

type UnwrapArray<T> = T extends Array<infer U> ? U : T;
type User = UnwrapArray<RouterOutputs["user"]["allUsers"]>;
type ChangePlayerState = RouterInputs["user"]["changeUserState"];

export function UpdateUserForm({
  params,
  onDone,
}: {
  params: {
    allUsers: User[];
    user: User;
    open: boolean;
  };
  onDone?: () => void;
}) {
  const changeUserState = api.user.changeUserState.useMutation({
    onSuccess() {
      toast({
        title: "User state updated",
      });
      onDone?.();
    },
    onError(error) {
      toast({
        title: "Error changing player state",
        variant: "destructive",
        description: error.message,
      });
    },
  });
  const [isPlayer, setIsPlayer] = useState(params.user.isPlayer);
  const [isMedic, setIsMedic] = useState(params.user.isMedic);
  const [hasChange, setHasChange] = useState(false);

  useEffect(() => {
    setHasChange(
      params.user.isPlayer !== isPlayer || params.user.isMedic !== isMedic,
    );
  }, [params.user, isPlayer, isMedic]);

  useEffect(() => {
    setIsPlayer(params.user.isPlayer);
    setIsMedic(params.user.isMedic);
    // params.open ensures that it is rerun when the dialog is opened
  }, [params.user, setIsPlayer, setIsMedic, params.open]);

  function onSubmit(data: ChangePlayerState) {
    changeUserState.mutate(data);
    toast({
      title: "Request send to change user state",
    });
  }

  return (
    <DialogContent>
      <DialogHeader>{params.user.name}</DialogHeader>
      <DialogDescription className="text-center">
        {params.user.userId}
      </DialogDescription>
      <div className="space-y-8">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <Switch id="is-admin" checked={params.user.isAdmin} disabled />
            <Label htmlFor="is-admin" className="text-right">
              Is Admin
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Can only be changed manually in Clerk dashboards
          </p>
        </div>
        <div className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <Switch
              id="is-moderator"
              checked={params.user.isModerator}
              disabled
            />
            <Label htmlFor="is-moderator" className="text-right">
              Is moderator
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            A user is a moderator if they are assigned to a hub
          </p>
        </div>
        <div className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <Switch
              id="is-medic"
              checked={isMedic}
              onCheckedChange={setIsMedic}
            />
            <Label htmlFor="is-medic" className="text-right">
              Is medic
            </Label>
          </div>
          <p className="text-sm text-muted-foreground">
            Can revive dead players
          </p>
        </div>
        <div className="flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <Switch
              id="is-player"
              checked={isPlayer}
              onCheckedChange={setIsPlayer}
            />
            <Label htmlFor="is-player" className="text-right">
              Is player
            </Label>
          </div>
        </div>
      </div>
      <DialogFooter className="flex flex-row justify-between">
        <Button onClick={onDone}>Close</Button>
        <Button
          type="submit"
          disabled={!hasChange}
          onClick={() =>
            onSubmit({ id: params.user.userId, isPlayer, isMedic })
          }
        >
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
