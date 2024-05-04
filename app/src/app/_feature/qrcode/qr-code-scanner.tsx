"use client";

import { QrReader } from "react-qr-reader";

export function QrCodeScanner({
  onReadUserId,
}: {
  onReadUserId?: (userId: string) => void;
}) {
  return (
    <QrReader
      onResult={(result, error) => {
        if (error) {
          console.info(error);
          return;
        }
        if (!result) {
          return;
        }
        const rawUrl = result.getText();
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
          console.info("read not valid URL", rawUrl);
        }
      }}
      constraints={{ facingMode: "environment" }}
    />
  );
}
