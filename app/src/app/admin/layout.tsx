import { redirect } from "next/navigation";
import { checkRole } from "~/lib/role-check";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await checkRole("admin"))) {
    redirect("/");
  }
  return <>{children}</>;
}
