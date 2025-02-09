"use client";

import { Scanner } from "@yudiel/react-qr-scanner";

export function QrCodeScanner({
  onReadUserId,
}: {
  onReadUserId?: (userId: string) => void;
}) {
  return (
    <Scanner
      onError={(error) => {
        console.info(error);
      }}
      onScan={(result) => {
        const rawUrl = result[0]?.rawValue;
        if (!rawUrl) {
          return;
        }
        try {
          const url = new URL(rawUrl, "http://base.url");
          const userId = url.searchParams.get("userId");
          if (!userId) {
            console.info("no userId in URL", rawUrl);
            return;
          }
          onReadUserId?.(userId);
        } catch (error) {
          // not a valid url
          console.info("read not valid URL", rawUrl, error);
        }
      }}
      constraints={{ facingMode: "environment" }}
    />
  );
}
