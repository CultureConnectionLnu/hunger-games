import TimerProvider from "../_feature/timer/timer-provider";

export default function FightLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TimerProvider>{children}</TimerProvider>;
}
