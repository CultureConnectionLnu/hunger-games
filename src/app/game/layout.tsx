import TimerProvider from "../_context/timer";

export default function FightLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TimerProvider>{children}</TimerProvider>;
}
