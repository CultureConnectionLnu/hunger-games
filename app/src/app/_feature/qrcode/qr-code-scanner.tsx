"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { QrReader } from "react-qr-reader";

export function QrCodeScanner() {
  const router = useRouter();
  const [navigationDone, setNavigationDone] = useState(false);
  return (
    <QrReader
      className="h-screen w-screen p-4"
      onResult={(result, error) => {
        if (error) {
          console.info(error);
          return;
        }
        if (!result) {
          return;
        }
        const url = result.getText();
        if (!navigationDone && checkIfNavigationIsAllowed(url)) {
          router.push(url);
          setNavigationDone(true);
        }
      }}
      constraints={{ facingMode: "environment" }}
    />
  );
}

function checkIfNavigationIsAllowed(url: string) {
  // TODO: check in detail if navigation is ok here
  return url.startsWith("/");
}
