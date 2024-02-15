"use client";

import { useUser } from "@clerk/nextjs";

import QRCode from "react-qr-code";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export function QrCode({
  route,
  params,
}: {
  route: string;
  params?: URLSearchParams;
}) {
  const { isLoaded, user } = useUser();
  const searchParams = params ?? new URLSearchParams();
  searchParams.set("userId", user?.id ?? "");
  const currentUrl = `${route}?${searchParams.toString()}`;

  return (
    <div className="flex flex-col items-center gap-2">
      <h1>QR Code</h1>
      <div className="relative mx-auto grid w-full max-w-xs items-center gap-2">
        {!isLoaded ? (
          <Skeleton className="flex aspect-square w-full animate-pulse items-center justify-center overflow-hidden rounded-lg bg-gray-100">
            <Skeleton className="relative aspect-square w-[256px] rounded-lg bg-white">
              <div className="absolute left-0 top-0 aspect-square w-16 rounded-tl-lg bg-gray-100" />
              <div className="absolute right-0 top-0 aspect-square w-16 rounded-tr-lg bg-gray-100" />
              <div className="absolute bottom-0 left-0 aspect-square w-16 rounded-bl-lg bg-gray-100" />
              <Skeleton className="absolute left-0 top-0 aspect-square w-12 rounded-none rounded-tl-lg  bg-white" />
              <Skeleton className="absolute right-0 top-0 aspect-square w-12 rounded-none rounded-tr-lg  bg-white" />
              <Skeleton className="absolute bottom-0 left-0 aspect-square w-12 rounded-none rounded-bl-lg  bg-white" />
            </Skeleton>
          </Skeleton>
        ) : (
          <>
            <div className="flex aspect-square w-full flex-col items-center justify-center overflow-hidden">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <QRCode value={currentUrl} />
                  </TooltipTrigger>
                  <TooltipContent>{currentUrl}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="flex flex-col items-center text-sm font-medium not-italic text-gray-500">
              Scan this code with your phone
            </p>
          </>
        )}
      </div>
    </div>
  );
}
