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
import * as MdIcons from "react-icons/md";
import { Button } from "~/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "~/components/ui/navigation-menu";
import { ScrollArea } from "~/components/ui/scroll-area";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "~/components/ui/sheet";
import {
  type EvaluatedNavigationBarEntry,
  type EvaluatedHeaderConfig,
  type EvaluatedNavigationBarConfig,
} from "./header-config";

export function ClientHeader({
  config,
}: {
  config: {
    headerConfig: EvaluatedHeaderConfig;
    navConfig: EvaluatedNavigationBarConfig;
  };
}) {
  const pathname = usePathname();

  if (pathname.startsWith("/game/fight")) {
    return null;
  }

  return (
    <header>
      <div className="flex h-14 w-full items-center justify-between px-4">
        <SideBar config={config.headerConfig} />
        <NavigationBar config={config.navConfig} />
      </div>
    </header>
  );
}

function NavigationBar({ config }: { config: EvaluatedNavigationBarConfig }) {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <SignedOut>
          {config.signedOutEntries.map((entry) => (
            <NavigationBarEntry
              key={entry.title}
              entry={entry}
            ></NavigationBarEntry>
          ))}
        </SignedOut>
        <SignedIn>
          {config.signedInEntries.map((entry) => (
            <NavigationBarEntry
              key={entry.title}
              entry={entry}
            ></NavigationBarEntry>
          ))}
        </SignedIn>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

function NavigationBarEntry({ entry }: { entry: EvaluatedNavigationBarEntry }) {
  const Icon = entry.icon ? MdIcons[entry.icon] : undefined;
  const icon = Icon ? <Icon className="mr-2 h-4 w-4" /> : undefined;
  const content = (
    <Button variant="ghost" className="w-full justify-start">
      {icon}
      {entry.title}
    </Button>
  );

  const link = entry.href ? (
    <NavigationMenuLink
      className="flex h-7 items-center justify-center rounded-full text-center text-sm transition-colors hover:text-primary"
      href={entry.href}
    >
      {content}
    </NavigationMenuLink>
  ) : !entry.customLink ? (
    content
  ) : entry.customLink === "sign-in" ? (
    <SignIn>{content}</SignIn>
  ) : (
    <SignOut>{content}</SignOut>
  );

  return <NavigationMenuItem>{link}</NavigationMenuItem>;
}

function SideBar({ config }: { config: EvaluatedHeaderConfig }) {
  const listContent = config.groups.map((group) => {
    return (
      <ListGroup key={group.title}>
        <ListGroupHeader>{group.title}</ListGroupHeader>
        <ListGroupContent>
          {group.links.map((link) => {
            const Icon = MdIcons[link.icon];
            const button = (
              <Button variant="ghost" className="w-full justify-start">
                <Icon className="mr-2 h-4 w-4"></Icon>
                {link.title}
              </Button>
            );
            const entry = (
              <SheetClose asChild key={link.title}>
                {link.customLink ? (
                  link.customLink === "sign-in" ? (
                    <SignIn>{button}</SignIn>
                  ) : (
                    <SignOut>{button}</SignOut>
                  )
                ) : (
                  <Link href={link.href}>{button}</Link>
                )}
              </SheetClose>
            );

            if (link.require === "sign-out") {
              return <SignedOut key={link.title}>{entry}</SignedOut>;
            }
            if (link.require === "sign-in") {
              return <SignedIn key={link.title}>{entry}</SignedIn>;
            }
            return entry;
          })}
        </ListGroupContent>
      </ListGroup>
    );
  });
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button className="rounded-md" size="icon" variant="ghost">
          <MenuIcon className="h-6 w-6" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full" side="left">
        <ScrollArea className="h-screen">
          <List>{listContent}</List>
        </ScrollArea>
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

function SignIn({ children }: { children: React.ReactNode }) {
  return <SignInButton>{children}</SignInButton>;
}

function SignOut({ children }: { children: React.ReactNode }) {
  return (
    <SignOutButton>
      <Link href="/">{children}</Link>
    </SignOutButton>
  );
}
