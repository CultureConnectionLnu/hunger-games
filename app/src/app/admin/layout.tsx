import { redirect } from "next/navigation";
import { UserHandler } from "~/server/api/logic/user";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await UserHandler.instance.checkRole("admin"))) {
    redirect("/404");
  }
  return <>{children}</>;
}
