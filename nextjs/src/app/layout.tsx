import "~/styles/globals.css";

import { GeistSans } from "geist/font/sans";
import { type Metadata } from "next";
import { ClerkProvider, SignedIn } from "@clerk/nextjs";
import { StoreProvider } from "~/provider/store-provider";
import { TooltipProvider } from "~/components/ui/tooltip";
import JoinRunningGame from "./_components/join-running-fight";

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
      <html lang="en" className={`${GeistSans.variable}`}>
        <body>
          <TooltipProvider>
            <StoreProvider>
              <SignedIn>
                <JoinRunningGame />
              </SignedIn>
              {children}
            </StoreProvider>
          </TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
