"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState, createContext, useContext } from "react";
import type { UserRoles } from "~/server/api/logic/handler";
import { api } from "~/trpc/react";

const RolesContext = createContext<Record<UserRoles, boolean> | undefined>(
  undefined,
);

export function RolesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const { data } = api.user.getYourRoles.useQuery(undefined, {
    enabled: Boolean(user),
  });

  const roles = {
    admin: Boolean(user?.publicMetadata.isAdmin),
    moderator: data?.isModerator ?? false,
    player: data?.isPlayer ?? false,
    medic: data?.isMedic ?? false,
  } satisfies Record<UserRoles, boolean>;

  return (
    <RolesContext.Provider value={roles}>{children}</RolesContext.Provider>
  );
}

export function useRoles() {
  const context = useContext(RolesContext);
  if (context === undefined) {
    throw new Error("useRoles must be used within a RolesProvider");
  }
  return context;
}

export function useCheckRole(role: UserRoles) {
  const [state, setState] = useState(false);
  const roles = useRoles();

  useEffect(() => {
    setState(roles[role]);
  }, [setState, role, roles]);

  return [state] as const;
}

export function useCheckRoles(roles: UserRoles[]) {
  const [allRoles, setAllRoles] = useState(false);
  const [anyRole, setAnyRole] = useState(false);
  const userRoles = useRoles();

  useEffect(() => {
    setAllRoles(roles.every((role) => userRoles[role]));
    setAnyRole(roles.some((role) => userRoles[role]));
  }, [setAllRoles, setAnyRole, roles, userRoles]);

  return { allRoles, anyRole };
}
