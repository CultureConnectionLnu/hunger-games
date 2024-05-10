"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import type { UserRoles } from "~/server/api/logic/handler";
import { api } from "~/trpc/react";

export function useCheckRole(role: UserRoles) {
  const { user } = useUser();
  const [state, setState] = useState(false);
  const { data } = api.user.getYourRoles.useQuery(undefined, {
    enabled: Boolean(user) && role !== "admin",
  });

  useEffect(() => {
    if (role === "admin") {
      setState(Boolean(user?.publicMetadata.isAdmin));
      return;
    }
    if (!data) {
      setState(false);
      return;
    }

    if (role === "moderator") {
      setState(data.isModerator);
      return;
    }
    if (role === "player") {
      setState(data.isPlayer);
      return;
    }
    if (role === "medic") {
      setState(data.isMedic);
      return;
    }

    // should be dead code
    setState(false);
    role satisfies never;
  }, [user, setState, role, data]);

  return [state] as const;
}
