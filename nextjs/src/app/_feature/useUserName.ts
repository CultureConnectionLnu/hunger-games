"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "~/server/api";

export function useUserName(userId: string | undefined | null) {
  const { data, isLoading } = useQuery({
    queryKey: ["user-name", userId],
    queryFn: () => {
      if (!userId) {
        return undefined;
      }
      return api.user.getUserName({ userId });
    },
  });

  if (!data || isLoading) {
    return {
      isLoading: true,
      name: undefined,
    };
  }

  return {
    isLoading: false,
    name: data,
  };
}
