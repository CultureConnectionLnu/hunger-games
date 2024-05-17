import { api } from "~/trpc/server";
import { ConfigForm } from "./_components/form";

export default async function GameConfigPage() {
  const currentConfig = await api.gameConfig.currentConfig.query();
  return <ConfigForm params={currentConfig} />;
}
