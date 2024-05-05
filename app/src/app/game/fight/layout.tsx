import { UserHandler } from "~/server/api/logic/user";
import TimerProvider from "../../_feature/timer/timer-provider";
import { redirect } from "next/navigation";

export default async function FightLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await UserHandler.instance.checkRole("player"))) {
    redirect("/no-player");
  }
  return <TimerProvider>{children}</TimerProvider>;
}
