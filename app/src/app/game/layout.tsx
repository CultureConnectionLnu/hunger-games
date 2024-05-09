import { redirect } from "next/navigation";
import { userHandler } from "~/server/api/logic/handler";

export default async function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await userHandler.checkRole("player"))) {
    redirect("/no-player");
  }
  return <>{children}</>;
}
