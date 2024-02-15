import { QrCodeScanner } from "../_components/qr-code-scanner";
import { unstable_noStore as noStore } from "next/cache";

export default async function MatchOverviewPage() {
  noStore();
  return (
    <div className="flex flex-col items-center">
      <h1>Scan the QR code of your opponent</h1>
      <QrCodeScanner/>
    </div>
  );
}
