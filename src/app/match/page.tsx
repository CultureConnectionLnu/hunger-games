import Link from "next/link";
import { StartMatch } from "../_components/start-match";
import { QrCode } from "../_components/qr-code-visualizer";
import { Button } from "~/components/ui/button";

export default async function MatchOverviewPage() {
  return (
    <div>
      <h1>Match overview</h1>
      <StartMatch />
      <QrCode route="/match" />
      <Button>
        <Link href="/scan">Scan qr code</Link>
      </Button>
    </div>
  );
}
