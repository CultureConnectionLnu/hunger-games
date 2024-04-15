"use client";

import {
  SignInButton,
  SignOutButton,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import {
  MdBarChart,
  MdLockOpen,
  MdManageAccounts,
  MdMap,
  MdMenuBook,
  MdOutlinePowerSettingsNew,
  MdQrCode,
  MdQrCodeScanner,
  MdSettings,
  MdHistory,
} from "react-icons/md";
import { Button } from "~/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuLink,
  NavigationMenuList,
} from "~/components/ui/navigation-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "~/components/ui/sheet";
import { useFight } from "../auto-join-game/fight-provider";

export default function Header() {
  const { currentFight } = useFight();
  const pathname = usePathname();

  if (pathname.startsWith("/game")) {
    return <></>;
  }

  return (
    <header>
      {currentFight !== undefined && <JoinRunningGame />}
      <div className="flex h-14 w-full items-center justify-between px-4">
        <SideBar />
        <NavigationBar />
      </div>
    </header>
  );
}

function JoinRunningGame() {
  return (
    <div className="h-36 w-full bg-red-400 text-center">
      <Link href="/game">
        <div className="flex h-full w-full items-center justify-center">
          Back to current game
        </div>
      </Link>
    </div>
  );
}

function NavigationBar() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <SignedOut>
          <NavigationMenuLink>
            <SignInButton>
              <Button variant="ghost" className="w-full justify-start">
                <MdLockOpen className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            </SignInButton>
          </NavigationMenuLink>
        </SignedOut>
        <SignedIn>
          <NavigationMenuLink>
            <Link
              className="flex h-7 items-center justify-center rounded-full px-4 text-center text-sm transition-colors hover:text-primary"
              href="/qr-code"
            >
              Qr-Code
            </Link>
          </NavigationMenuLink>
          <NavigationMenuLink>
            <Link
              className="flex h-7 items-center justify-center rounded-full px-4 text-center text-sm transition-colors hover:text-primary"
              href="/scan"
            >
              Scan
            </Link>
          </NavigationMenuLink>
        </SignedIn>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

function SideBar() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="rounded-md" size="icon" variant="ghost">
          <MenuIcon className="h-6 w-6" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full" side="left">
        <List>
          <ListGroup>
            <ListGroupHeader>General</ListGroupHeader>
            <ListGroupContent>
              <SheetClose asChild>
                <Link href="/">
                  <Button variant="ghost" className="w-full justify-start">
                    <MdMap className="mr-2 h-4 w-4" />
                    Overview
                  </Button>
                </Link>
              </SheetClose>
              <SheetClose asChild>
                <Link href="#">
                  <Button variant="ghost" className="w-full justify-start">
                    <MdMenuBook className="mr-2 h-4 w-4" />
                    Rules 🏗️
                  </Button>
                </Link>
              </SheetClose>
            </ListGroupContent>
          </ListGroup>

          <SignedIn>
            <ListGroup>
              <ListGroupHeader>Current Game</ListGroupHeader>
              <ListGroupContent>
                <SheetClose asChild>
                  <Link href="/qr-code">
                    <Button variant="ghost" className="w-full justify-start">
                      <MdQrCode className="mr-2 h-4 w-4" />
                      Qr-code
                    </Button>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/scan">
                    <Button variant="ghost" className="w-full justify-start">
                      <MdQrCodeScanner className="mr-2 h-4 w-4" />
                      Scan
                    </Button>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/history">
                    <Button variant="ghost" className="w-full justify-start">
                      <MdHistory className="mr-2 h-4 w-4" />
                      History
                    </Button>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/dashboard">
                    <Button variant="ghost" className="w-full justify-start">
                      <MdBarChart className="mr-2 h-4 w-4" />
                      Dashboard
                    </Button>
                  </Link>
                </SheetClose>
              </ListGroupContent>
            </ListGroup>
          </SignedIn>

          <ListGroup>
            <ListGroupHeader>Account</ListGroupHeader>
            <SignedIn>
              <ListGroupContent>
                <SheetClose asChild>
                  <Link href="/profile">
                    <Button variant="ghost" className="w-full justify-start">
                      <MdManageAccounts className="mr-2 h-4 w-4" />
                      Profile
                    </Button>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="#">
                    <Button variant="ghost" className="w-full justify-start">
                      <MdSettings className="mr-2 h-4 w-4" />
                      Settings 🏗️
                    </Button>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/">
                    <SignOutButton>
                      <Button variant="ghost" className="w-full justify-start">
                        <MdOutlinePowerSettingsNew className="mr-2 h-4 w-4" />
                        Sign Out
                      </Button>
                    </SignOutButton>
                  </Link>
                </SheetClose>
              </ListGroupContent>
            </SignedIn>
            <SignedOut>
              <ListGroupContent>
                <SignInButton>
                  <Button variant="ghost" className="w-full justify-start">
                    <MdLockOpen className="mr-2 h-4 w-4" />
                    Sign In
                  </Button>
                </SignInButton>
              </ListGroupContent>
            </SignedOut>
          </ListGroup>
        </List>
      </SheetContent>
    </Sheet>
  );
}

function List({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-12">
      {children}
      <div className="space-y-4 py-4"></div>
    </div>
  );
}

function ListGroup({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-2">{children}</div>;
}

function ListGroupHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-2 text-lg font-semibold tracking-tight">{children}</h2>
  );
}

function ListGroupContent({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col space-y-2">{children}</div>;
}

function MenuIcon({ className }: { className: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  );
}
