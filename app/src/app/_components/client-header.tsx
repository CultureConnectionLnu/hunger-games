"use client";
import { usePathname } from "next/navigation";
import Header from "./header";

export default function ClientHeader() {
  const pathname = usePathname();

  if (pathname.startsWith("/game/fight")) {
    return null;
  }

  return <Header />;
}
