"use client";
import Link from "next/link";
import {
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenu,
} from "~/components/ui/navigation-menu";
import { Button } from "~/components/ui/button";
import { SheetTrigger, SheetContent, Sheet } from "~/components/ui/sheet";

export default function Header() {
  return (
    <header className="flex h-14 w-full items-center justify-between px-4">
      <div className="space-y-2">
        <span className="block h-0.5 w-8 animate-pulse bg-gray-600"></span>
        <span className="block h-0.5 w-8 animate-pulse bg-gray-600"></span>
        <span className="block h-0.5 w-8 animate-pulse bg-gray-600"></span>
      </div>
      {/* todo: insert sheet for the side navigation: contains profile for now, later also dashboard */}
      <NavigationMenu>
        <NavigationMenuList className="">
          <NavigationMenuLink>
            <Link
              className="flex h-7 items-center justify-center rounded-full px-4 text-center text-sm transition-colors hover:text-primary"
              href="/"
            >
              Home
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
        </NavigationMenuList>
      </NavigationMenu>
    </header>
  );
}

export function Component() {
  return (
    <header className="flex h-14 w-full shrink-0 items-center px-4">
      <Link className="hidden md:flex" href="#">
        <MountainIcon className="h-6 w-6" />
        <span className="sr-only">Acme Inc</span>
      </Link>
      <NavigationMenu className="hidden flex-1 md:flex">
        <NavigationMenuList className="justify-end">
          <NavigationMenuLink asChild>
            <Link
              className="group inline-flex h-9 w-max items-center justify-center rounded-md px-4 text-sm font-medium"
              href="#"
            >
              Home
            </Link>
          </NavigationMenuLink>
          <NavigationMenuLink asChild>
            <Link
              className="group inline-flex h-9 w-max items-center justify-center rounded-md px-4 text-sm font-medium"
              href="#"
            >
              Scan
            </Link>
          </NavigationMenuLink>
        </NavigationMenuList>
      </NavigationMenu>
      <Sheet>
        <SheetTrigger asChild>
          <Button className="rounded-md" size="icon" variant="ghost">
            <MenuIcon className="h-6 w-6" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent className="w-56" side="left">
          <div className="flex h-14 items-center px-4">
            <Link className="hidden md:flex" href="#">
              <MountainIcon className="h-6 w-6" />
              <span className="sr-only">Acme Inc</span>
            </Link>
            <Sheet>
              <SheetTrigger asChild>
                <Button className="rounded-md" size="icon" variant="ghost">
                  <MenuIcon className="h-6 w-6" />
                  <span className="sr-only">Toggle navigation menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent className="w-56" side="left">
                <div className="flex h-14 items-center px-4">
                  <Link
                    className="inline-flex h-9 items-center justify-center rounded-md bg-gray-900 px-4 text-sm font-medium text-gray-50"
                    href="#"
                  >
                    Home
                  </Link>
                </div>
                <div className="flex h-14 items-center px-4">
                  <Link
                    className="inline-flex h-9 items-center justify-start"
                    href="#"
                  >
                    Scan
                  </Link>
                </div>
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex h-14 items-center px-4">
            <Link
              className="inline-flex h-9 items-center justify-start"
              href="#"
            >
              Scan
            </Link>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}

function MenuIcon(props) {
  return (
    <svg
      {...props}
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

function MountainIcon(props) {
  return (
    <svg
      {...props}
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
      <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
    </svg>
  );
}
