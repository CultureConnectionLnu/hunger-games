import { ClientHeader } from "./client-header";
import { getHeaderConfig } from "./header-config";

export default async function Header() {
  const config = await getHeaderConfig();

  return <ClientHeader config={config} />;
}
