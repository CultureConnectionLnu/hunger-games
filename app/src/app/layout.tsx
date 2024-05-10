import "~/styles/globals.css";

import { ClerkProvider } from "@clerk/nextjs";
import { Inter } from "next/font/google";

import { Toaster } from "~/components/ui/toaster";
import { TRPCReactProvider } from "~/trpc/react";
import ClientHeader from "./_components/client-header";
import FightProvider from "./_feature/auto-join-game/fight-provider";
import { TooltipProvider } from "~/components/ui/tooltip";
import { RolesProvider } from "./_feature/auth/role-check";
import { CountdownProvider } from "./_feature/timer/countdown-provider";
import JoinRunningGame from "./_components/join-running-fight";
import { ShowWoundedState } from "./_components/show-wounded-state";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata = {
  title: "Hunger Games",
  description: "Culture Connection Hunger Games Student Game",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`font-sans ${inter.variable}`}>
          <TRPCReactProvider>
            <RolesProvider>
              <CountdownProvider>
                <FightProvider>
                  <TooltipProvider>
                    <ClientHeader />
                    <JoinRunningGame />
                    <ShowWoundedState />
                    <div
                      style={{
                        // 56px is the height of the header
                        height: "calc(100vh - 56px)",
                      }}
                    >
                      {children}
                    </div>
                    <Toaster />
                  </TooltipProvider>
                </FightProvider>
              </CountdownProvider>
            </RolesProvider>
          </TRPCReactProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
