import {
  SignInButton,
  SignOutButton,
  SignedIn,
  SignedOut,
} from "@clerk/nextjs";
import Link from "next/link";
import * as React from "react";
import * as MdIcons from "react-icons/md";
import { MdLockOpen } from "react-icons/md";
import { Button } from "~/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "~/components/ui/navigation-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "~/components/ui/sheet";
import { type UserRoles } from "~/server/api/logic/user";
import { useCheckRole } from "../_feature/auth/role-check";

type HeaderConfig = {
  groups: {
    title: string;
    require?: "sign-in" | "sign-out" | "role-admin" | "none";
    links: HeaderLinkConfig[];
  }[];
};

type HeaderLinkConfig = {
  title: string;
  icon: keyof typeof MdIcons;
  require?: "sign-in" | "sign-out" | "none";
} & (
  | { href: string; customLink?: undefined }
  | {
      href?: undefined;
      customLink: (children: React.ReactNode) => React.ReactNode;
    }
);

export default function Header() {
  return (
    <header>
      <div className="flex h-14 w-full items-center justify-between px-4">
        <SideBar
          config={{
            groups: [
              {
                title: "General",
                links: [
                  {
                    title: "Overview",
                    href: "/",
                    icon: "MdMap",
                    require: "none",
                  },
                  {
                    title: "Rules 🏗️",
                    href: "#",
                    icon: "MdMenuBook",
                    require: "none",
                  },
                ],
              },
              {
                title: "Current Game",
                require: "sign-in",
                links: [
                  {
                    title: "Qr-Code",
                    href: "/qr-code",
                    icon: "MdQrCode",
                  },
                  {
                    title: "Scan",
                    href: "/scan",
                    icon: "MdQrCodeScanner",
                  },
                  {
                    title: "History",
                    href: "/history",
                    icon: "MdHistory",
                  },
                  {
                    title: "Dashboard",
                    href: "/dashboard",
                    icon: "MdBarChart",
                  },
                ],
              },
              {
                title: "Account",
                links: [
                  {
                    title: "Profile",
                    href: "/profile",
                    icon: "MdManageAccounts",
                    require: "sign-in",
                  },
                  {
                    title: "Settings 🏗️",
                    href: "#",
                    icon: "MdSettings",
                    require: "sign-in",
                  },
                  {
                    title: "Sign Out",
                    customLink: (children) => (
                      <SignOutButton>{children}</SignOutButton>
                    ),
                    icon: "MdOutlinePowerSettingsNew",
                    require: "sign-in",
                  },
                  {
                    title: "Sign In",
                    customLink: (children) => (
                      <SignInButton>{children}</SignInButton>
                    ),
                    icon: "MdLockOpen",
                    require: "sign-out",
                  },
                ],
              },
              {
                title: "Admin",
                require: "role-admin",
                links: [
                  {
                    title: "Hub Configuration",
                    icon: "MdSettings",
                    href: "/admin/hub",
                  },
                  {
                    title: "User Overview",
                    icon: "MdSettings",
                    href: "/admin/users",
                  },
                ],
              },
            ],
          }}
        />
        <NavigationBar />
      </div>
    </header>
  );
}

function NavigationBar() {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <SignedOut>
          <NavigationMenuItem>
            <SignInButton>
              <Button variant="ghost" className="w-full justify-start">
                <MdLockOpen className="mr-2 h-4 w-4" />
                Sign In
              </Button>
            </SignInButton>
          </NavigationMenuItem>
        </SignedOut>
        <SignedIn>
          <NavigationMenuLink
            className="flex h-7 items-center justify-center rounded-full px-4 text-center text-sm transition-colors hover:text-primary"
            href="/qr-code"
          >
            Qr-Code
          </NavigationMenuLink>
          <NavigationMenuLink
            className="flex h-7 items-center justify-center rounded-full px-4 text-center text-sm transition-colors hover:text-primary"
            href="/scan"
          >
            Scan
          </NavigationMenuLink>
        </SignedIn>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

async function SideBar({ config }: { config: HeaderConfig }) {
  const listContent = config.groups.map((group) => {
    const groupContent = (
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
            const itemContent = (
              <SheetClose asChild key={link.title}>
                {link.customLink ? (
                  link.customLink(button)
                ) : (
                  <Link href={link.href}>{button}</Link>
                )}
              </SheetClose>
            );
            if (link.require === "none" || link.require === undefined) {
              return itemContent;
            }
            if (link.require === "sign-in") {
              return <SignedIn key={link.title}>{itemContent}</SignedIn>;
            }
            return <SignedOut key={link.title}>{itemContent}</SignedOut>;
          })}
        </ListGroupContent>
      </ListGroup>
    );
    if (group.require === "none" || group.require === undefined) {
      return groupContent;
    }
    if (group.require === "sign-in") {
      return <SignedIn key={group.title}>{groupContent}</SignedIn>;
    }
    if (group.require === "sign-out") {
      return <SignedOut key={group.title}>{groupContent}</SignedOut>;
    }
    if (group.require === "role-admin") {
      return (
        <RenderOnRole key={group.title} role="admin">
          {groupContent}
        </RenderOnRole>
      );
    }

    group.require satisfies never;
    return undefined;
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
        <List>{listContent}</List>
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

function RenderOnRole({
  children,
  role,
}: {
  role: UserRoles;
  children: React.ReactNode;
}) {
  const [hasRole] = useCheckRole(role);
  if (!hasRole) {
    return <></>;
  }
  return <>{children}</>;
}
