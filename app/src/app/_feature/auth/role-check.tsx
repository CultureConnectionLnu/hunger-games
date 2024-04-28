"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import type { UserRoles } from "~/server/api/logic/user";

export function useCheckRole(role: UserRoles) {
  const { user } = useUser();
  const [state, setState] = useState(false);

  useEffect(() => {
    setState(user?.publicMetadata.role === role);
  }, [user, setState, role]);

  return [state] as const;
}
