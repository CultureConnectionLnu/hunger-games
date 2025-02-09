"use client";
import { useStoreReady } from "~/provider/store-provider";

export function SignedIn({ children }: { children: React.ReactNode }) {
  const isSignedIn = useStoreReady();
  if (isSignedIn === false) {
    return <></>;
  }
  return <>{children}</>;
}
