import { UserHandler } from "~/server/api/logic/user";
import { redirect } from "next/navigation";

export default async function ScanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await UserHandler.instance.checkRole("player"))) {
    redirect("/no-player");
  }
  return <>{children}</>;
}
