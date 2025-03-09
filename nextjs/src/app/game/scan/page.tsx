"use client";

import { useRouter } from "next/navigation";
import { Card, CardHeader } from "~/components/ui/card";
import { QrCodeScanner } from "../../_feature/qrcode/qr-code-scanner";

export default function MatchOverviewPage() {
  const router = useRouter();

  return (
    <Card className="border-0">
      <CardHeader className="text-center">
        Scan the QR code of your opponent
      </CardHeader>
      <QrCodeScanner
        onReadUserId={(userId) =>
          router.push(`/game/overview?userId=${userId}`)
        }
      />
    </Card>
  );
}
