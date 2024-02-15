"use client";

import { useUser } from "@clerk/nextjs";
import { FaSpinner } from "react-icons/fa";

import QRCode from "react-qr-code";

export function QrCode({ route, params }: { route: string, params?: URLSearchParams }) {
  const { isLoaded, user } = useUser();
  const searchParams = params ?? new URLSearchParams();
  searchParams.set("userId", user?.id ?? "");
  const currentUrl = `${route}?${searchParams.toString()}`

  return (
    <div className="flex flex-col items-center gap-2">
      <h1>QR Code</h1>
      {!isLoaded ? (
        <FaSpinner className="animate-spin" />
      ) : (
        <QRCode value={currentUrl} />
      )}
      {currentUrl}
    </div>
  );
}
