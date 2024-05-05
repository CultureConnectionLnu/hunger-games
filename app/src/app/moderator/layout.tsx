import { notFound } from "next/navigation";
import { UserHandler } from "~/server/api/logic/user";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await UserHandler.instance.checkRole("moderator"))) {
    notFound();
  }
  return <>{children}</>;
}
