import { redirect } from "next/navigation";
import { StoreReadyLoading } from "~/provider/store-provider";
import { api } from "~/server/api";

export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await api.user.hasRole({ role: "player" }))) {
    redirect("/no-player");
  }

  return <StoreReadyLoading>{children}</StoreReadyLoading>;
}
