"use client";

import { useRouter } from "next/navigation";
import {
  extractUserIdFromUrl,
  QrCodeScanner,
} from "../../_feature/qrcode/qr-code-scanner";
import { Card, CardHeader } from "~/components/ui/card";
// the import in dev mode is wrong if not for this * import
import * as env from "~/env";
import { useRef } from "react";

export default function MatchOverviewPage() {
  const router = useRouter();

  return (
    <Card className="border-0">
      <CardHeader className="text-center">
        Scan the QR code of your opponent
      </CardHeader>
      {env.env.NEXT_PUBLIC_NODE_ENV === "development" && <ManualInput />}
      <QrCodeScanner
        onReadUserId={(userId) =>
          router.push(`/game/overview?userId=${userId}`)
        }
      />
    </Card>
  );
}

function ManualInput() {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-2">
      <p>
        If you want to test the app without scanning a QR code, you can enter a
        user ID manually.
      </p>
      <input
        ref={ref}
        type="text"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const userId = extractUserIdFromUrl(ref.current?.value ?? "");
            if (!userId) return;
            router.push(`/game/overview?userId=${userId}`);
          }
        }}
      />
    </div>
  );
}
