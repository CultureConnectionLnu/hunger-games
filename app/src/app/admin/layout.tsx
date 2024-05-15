import { notFound } from "next/navigation";
import { userHandler } from "~/server/api/logic/handler";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  if (!(await userHandler.checkRole("admin"))) {
    notFound();
  }
  return <>{children}</>;
}
