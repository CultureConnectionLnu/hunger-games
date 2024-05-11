import React from "react";
import { WoundedProvider } from "./_components/wounded-provider";

export default function WoundedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <WoundedProvider>{children}</WoundedProvider>;
}
