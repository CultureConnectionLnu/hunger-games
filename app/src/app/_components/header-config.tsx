import type * as MdIcons from "react-icons/md";
import { userHandler, type UserRoles } from "~/server/api/logic/handler";

const headerConfig: HeaderConfig = {
  groups: [
    {
      title: "General",
      links: [
        {
          title: "Home",
          href: "/",
          icon: "MdHome",
        },
        {
          title: "Rules 🏗️",
          href: "#",
          icon: "MdMenuBook",
        },
      ],
    },
    {
      title: "Current Game",
      require: "sign-in",
      links: [
        {
          title: "Overview",
          href: "/game/overview",
          icon: "MdDashboard",
          require: "role-player",
        },
        {
          title: "Scan",
          href: "/game/scan",
          icon: "MdQrCodeScanner",
          require: "role-player",
        },
        {
          title: "Current Quest",
          href: "/game/quest",
          icon: "MdMap",
          require: "role-player",
        },
        {
          title: "History",
          href: "/game/history",
          icon: "MdHistory",
          require: "role-player",
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
          title: "Your ID",
          href: "/qr-code",
          icon: "MdQrCode",
          require: "sign-in",
        },
        {
          title: "Sign Out",
          customLink: "sign-out",
          icon: "MdOutlinePowerSettingsNew",
          require: "sign-in",
        },
        {
          title: "Sign In",
          customLink: "sign-in",
          icon: "MdLockOpen",
          require: "sign-out",
        },
      ],
    },
    {
      title: "Moderator",
      require: ["role-moderator", "role-medic"],
      links: [
        {
          title: "Quest Overview",
          icon: "MdList",
          href: "/moderator/quest",
          require: "role-moderator",
        },
        {
          title: "Medic Overview",
          icon: "MdList",
          href: "/moderator/medic",
          require: "role-medic",
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
        {
          title: "Ongoing Quest Overview",
          icon: "MdList",
          href: "/admin/quest",
        },
        {
          title: "Game Config",
          icon: "MdSettings",
          href: "/admin/config",
        },
      ],
    },
  ],
};

const navConfig: NavigationBarConfig = {
  signedOutEntries: [
    {
      icon: "MdLockOpen",
      title: "Sign In",
      customLink: "sign-in",
    },
  ],
  signedInEntries: [
    {
      icon: "MdDashboard",
      title: "Overview",
      href: "/game/overview",
      require: "role-player",
    },
    {
      icon: "MdQrCodeScanner",
      title: "Scan",
      href: "/game/scan",
      require: "role-player",
    },
    {
      icon: "MdQrCode",
      title: "Your ID",
      href: "/qr-code",
      require: "not-role-player",
    },
  ],
};

type Roles = "role-admin" | "role-moderator" | "role-medic" | "role-player";
type Permission = "sign-in" | "sign-out";
type HeaderConfig = {
  groups: {
    title: string;
    require?: Permission | Roles | Roles[];
    links: HeaderLinkConfig[];
  }[];
};

type HeaderLinkConfig = {
  title: string;
  icon: keyof typeof MdIcons;
  require?: Permission | Roles | Roles[];
} & (
  | { href: string; customLink?: undefined }
  | {
      href?: undefined;
      customLink: "sign-in" | "sign-out";
    }
);

export type EvaluatedHeaderConfig = {
  groups: {
    title: string;
    require: "sign-in" | "sign-out" | "none";
    links: EvaluatedHeaderLinkConfig[];
  }[];
};

export type EvaluatedHeaderLinkConfig = {
  title: string;
  icon: keyof typeof MdIcons;
  require: "sign-in" | "sign-out" | "none";
} & (
  | { href: string; customLink?: undefined }
  | {
      href?: undefined;
      customLink: "sign-in" | "sign-out";
    }
);

type NavigationBarConfig = {
  signedOutEntries: NavigationBarEntry[];
  signedInEntries: NavigationBarEntry[];
};

type NavigationBarEntry = {
  icon?: keyof typeof MdIcons;
  title: string;
  require?: `not-${Roles}` | Roles;
} & (
  | { href: string; customLink?: undefined }
  | {
      href?: undefined;
      customLink: "sign-in" | "sign-out";
    }
);

export type EvaluatedNavigationBarConfig = {
  signedOutEntries: EvaluatedNavigationBarEntry[];
  signedInEntries: EvaluatedNavigationBarEntry[];
};
export type EvaluatedNavigationBarEntry = Omit<NavigationBarEntry, "require">;

export async function getHeaderConfig() {
  const roles = await userHandler.getAllRolesOfCurrentUser();
  const evalHeaderConfig: EvaluatedHeaderConfig = {
    groups: headerConfig.groups
      .filter((group) => filterRequire(roles, group.require))
      .map(({ links: baseLinks, title, require }) => {
        const links = mapLinkConfig(roles, baseLinks);
        if (require === "sign-in" || require === "sign-out")
          return { title, require, links };

        return { title, require: "none", links };
      }),
  };

  const evalNavConfig: EvaluatedNavigationBarConfig = {
    signedInEntries: navConfig.signedInEntries
      .filter((entry) => filterNavRequire(roles, entry.require))
      .map(({ require: _, ...entry }) => entry),
    signedOutEntries: navConfig.signedOutEntries
      .filter((entry) => filterNavRequire(roles, entry.require))
      .map(({ require: _, ...entry }) => entry),
  };

  return { headerConfig: evalHeaderConfig, navConfig: evalNavConfig };
}

function filterRequire(
  roles: Record<UserRoles, boolean>,
  require?: Permission | Roles | Roles[],
): boolean {
  if (!require) return true;
  if (require === "sign-in" || require === "sign-out") return true;
  const requiredRoles = (Array.isArray(require) ? require : [require]).map(
    (x) => x.replace("role-", "") as UserRoles,
  );
  return requiredRoles.some((role) => roles[role]);
}

function mapLinkConfig(
  roles: Record<UserRoles, boolean>,
  links: HeaderLinkConfig[],
): EvaluatedHeaderLinkConfig[] {
  return links
    .filter((link) => filterRequire(roles, link.require))
    .map(({ require, ...partialLink }) => {
      if (require === "sign-in" || require === "sign-out")
        return {
          require,
          ...partialLink,
        };
      return {
        require: "none",
        ...partialLink,
      };
    });
}

function filterNavRequire(
  roles: Record<UserRoles, boolean>,
  require?: `not-${Roles}` | Roles,
): boolean {
  if (!require) return true;
  const role = require.replace("not-", "").replace("role-", "") as UserRoles;
  const shouldHaveRole = roles[role];
  const invert = require.startsWith("not-");
  if (invert) {
    return !shouldHaveRole;
  }
  return shouldHaveRole;
}
