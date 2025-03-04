import { redirect } from "next/navigation";
import { userHandler } from "~/server/api/logic/handler";
import TimerProvider from "../../_feature/timer/timer-provider";

export default async function FightLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TimerProvider>{children}</TimerProvider>;
}
