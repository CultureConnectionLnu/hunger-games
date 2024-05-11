import { notFound } from "next/navigation";
import { userHandler } from "~/server/api/logic/handler";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log("layout moderator");
  const authResult = await userHandler.checkRole(["moderator", "medic"]);
  if (!authResult) {
    notFound();
  }
  return <>{children}</>;
}
