import "~/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { Toaster } from "~/components/ui/toaster";
import { TooltipProvider } from "~/components/ui/tooltip";
import { QueryProvider } from "~/provider/query-provider";
import { StoreProvider } from "~/provider/store-provider";
import Header from "./_components/header";
import JoinRunningGame from "./_components/join-running-fight";
import { SignedIn } from "./_components/signed-in";

export const metadata: Metadata = {
  title: "Hunger Games",
  description: "Culture Connection Hunger Games Student Game",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ClerkProvider>
      <QueryProvider>
        <html lang="en" className={`${GeistSans.variable}`}>
          <body>
            <TooltipProvider>
              <StoreProvider>
                <SignedIn>
                  <JoinRunningGame />
                </SignedIn>
                <Header />
                {children}
                <Toaster />
              </StoreProvider>
            </TooltipProvider>
          </body>
        </html>
      </QueryProvider>
    </ClerkProvider>
  );
}
