"use client";
import { useEffect, useState } from "react";
import { FindUser, type UserIdAndName } from "~/app/_components/find-user";
import { useWoundedPlayer } from "./wounded-provider";

export function FindWounded() {
  const [users, setUsers] = useState<UserIdAndName[]>([]);
  const { woundedPlayers } = useWoundedPlayer();

  useEffect(() => {
    setUsers(
      woundedPlayers.map((x) => ({
        userId: x.userId,
        name: x.userName,
      })),
    );
  }, [woundedPlayers, setUsers]);

  return (
    <FindUser
      params={{
        users,
      }}
      text={{
        dialogTrigger: "Find Wounded Player",
        dialogHeader: "Select a wounded player",
        selectButton: "Select",
      }}
    />
  );
}
