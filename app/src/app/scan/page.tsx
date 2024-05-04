"use client";

import { useRouter } from "next/navigation";
import { QrCodeScanner } from "../_feature/qrcode/qr-code-scanner";
import { Card, CardHeader } from "~/components/ui/card";

export default function MatchOverviewPage() {
  const router = useRouter();

  return (
    <Card className="border-0">
      <CardHeader className="text-center">
        Scan the QR code of your opponent
      </CardHeader>
      <QrCodeScanner
        onReadUserId={(userId) => router.push(`/qr-code?userId=${userId}`)}
      />
    </Card>
  );
}
