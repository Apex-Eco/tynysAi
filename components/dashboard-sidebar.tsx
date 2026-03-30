"use client";

import type { CSSProperties, ReactNode } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { i18n } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Route,
  Search,
  Settings,
  TrendingUp,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardSidebarProps = {
  children: ReactNode;
};

type SidebarCSSVars = CSSProperties & {
  "--dashboard-sidebar-width"?: string;
};

type SidebarAction = "search" | "home" | "location" | "route" | "trends";

const AQI_SIDEBAR_LABELS = [
  { label: "Good", range: "0-50", className: "text-emerald-300" },
  { label: "Moderate", range: "51-100", className: "text-lime-300" },
  { label: "USG", range: "101-150", className: "text-yellow-300" },
  { label: "Unhealthy", range: "151-200", className: "text-orange-300" },
  { label: "Very Unhealthy", range: "201-300", className: "text-red-300" },
  { label: "Hazardous", range: "300+", className: "text-fuchsia-300" },
] as const;

export function DashboardSidebar({ children }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [activeAction, setActiveAction] = useState<SidebarAction>("route");
  const [searchTerm, setSearchTerm] = useState("");

  const currentLocale = pathname?.split("/")[1] ?? "";
  const locale = (i18n.locales as readonly string[]).includes(currentLocale) ? currentLocale : i18n.defaultLocale;
  const profileLink = `/${locale}/dashboard`;
  const settingsLink = `/${locale}/dashboard/settings`;
  const helpLink = `/${locale}/request-demo`;

  const accountInitials = (() => {
    const source = session?.user?.name ?? session?.user?.email ?? "User";
    return source
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  })();

  const handleSignOut = () => {
    let callbackUrl = '/';
    try {
      const parts = typeof window !== 'undefined' ? window.location.pathname.split('/') : [];
      const currentLocale = parts && parts.length > 1 ? parts[1] : '';
      callbackUrl = (i18n.locales as readonly string[]).includes(currentLocale)
        ? `/${currentLocale}`
        : '/';
    } catch {
      callbackUrl = '/';
    }

    signOut({ callbackUrl });
  };

  const navigationItems: Array<{ id: SidebarAction; name: string; icon: React.ComponentType<{ className?: string }> }> = [
    {
      id: "route",
      name: "Route",
      icon: Route,
    },
    {
      id: "trends",
      name: "Historical Trends",
      icon: TrendingUp,
    },
  ] as const;

  const emitAction = (action: SidebarAction) => {
    setActiveAction(action);
    window.dispatchEvent(new CustomEvent("dashboard:action", { detail: { action } }));
  };

  const emitSearch = (value: string) => {
    setSearchTerm(value);
    window.dispatchEvent(new CustomEvent("dashboard:search", { detail: { query: value } }));
  };

  const dashboardStyles = useMemo<SidebarCSSVars>(() => {
    return {
      "--dashboard-sidebar-width": isCollapsed ? "5rem" : "16rem",
    };
  }, [isCollapsed]);

  const sidebarContent = (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100 transition-colors">
      <div className={cn("border-b border-slate-700 p-4", isCollapsed && "px-2")}>
        <div className="hidden items-center justify-between gap-2 lg:flex">
          {isCollapsed ? (
            <Button
              variant="ghost"
              size="icon"
              className="mx-auto h-10 w-10 rounded-xl border border-slate-700 bg-slate-900 p-1.5 text-slate-100 hover:bg-slate-800"
              onClick={() => setIsCollapsed(false)}
              aria-label="Expand sidebar"
            >
              <Image
                src="/tynys-logo.png"
                alt="TynysAi"
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
                priority
              />
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Image
                src="/tynys-logo.png"
                alt="TynysAi"
                width={26}
                height={26}
                className="h-6 w-6 object-contain"
                priority
              />
              <span className="font-mono text-sm font-semibold tracking-wide text-slate-100">
                tynysAi
              </span>
            </div>
          )}
        </div>
      </div>

      {!isCollapsed ? (
        <div className="border-b border-slate-700 px-4 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(event) => emitSearch(event.target.value)}
              aria-label="Search sensors"
              placeholder="Search"
              className="h-10 border-slate-700 bg-slate-900 pl-9 text-sm text-slate-100 placeholder:text-slate-400"
            />
          </div>
        </div>
      ) : null}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigationItems.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => emitAction(item.id)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-base font-semibold transition-colors",
              activeAction === item.id
                ? "border-blue-500 bg-blue-600 text-white"
                : "border-transparent text-slate-100 hover:border-blue-500 hover:bg-slate-900 hover:text-white",
              isCollapsed && "justify-center px-2"
            )}
          >
            <item.icon
              className={cn(
                "h-5 w-5 flex-shrink-0",
                activeAction === item.id ? "text-white" : "text-slate-300"
              )}
            />
            {!isCollapsed && <span className="font-mono">{item.name}</span>}
          </button>
        ))}

      </nav>

      {/* Bottom Actions */}
      <div className="border-t border-slate-700 p-4">
        {!isCollapsed ? (
          <div className="mb-4 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              AQI Labels
            </p>
            <div className="space-y-1.5">
              {AQI_SIDEBAR_LABELS.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className={cn("font-semibold", item.className)}>{item.label}</span>
                  <span className="font-mono text-slate-300">{item.range}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border border-slate-700/80 bg-slate-900 px-2 py-2 text-left transition-colors hover:bg-slate-800",
                isCollapsed && "justify-center"
              )}
              aria-label="Open account menu"
            >
              <Avatar className="h-9 w-9 border border-slate-700 bg-slate-800 text-slate-100">
                <AvatarFallback className="bg-slate-800 text-xs font-semibold text-slate-100">
                  {accountInitials}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed ? (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">Account</p>
                  <p className="truncate text-xs text-slate-400">{session?.user?.email ?? "Signed in"}</p>
                </div>
              ) : null}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="right" className="w-52 border-slate-700 bg-slate-950 text-slate-100">
            <DropdownMenuLabel className="text-slate-200">Account</DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem asChild>
              <Link href={profileLink} className="cursor-pointer text-slate-100">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={settingsLink} className="cursor-pointer text-slate-100">
                <Settings className="mr-2 h-4 w-4" />
                <span>Account Settings</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={helpLink} className="cursor-pointer text-slate-100">
                <CircleHelp className="mr-2 h-4 w-4" />
                <span>Help / Support</span>
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-700" />
            <DropdownMenuItem className="cursor-pointer text-red-300 focus:text-red-200" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div style={dashboardStyles}>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 hidden transform border-r border-slate-700 bg-slate-950 text-slate-100 transition-[width] duration-300 lg:block",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        {sidebarContent}

        <Button
          variant="secondary"
          size="icon"
          className={cn(
            "absolute top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-full border border-slate-700 bg-slate-900 text-slate-100 shadow-lg hover:bg-slate-800",
            isCollapsed ? "right-[-12px]" : "right-[-14px]"
          )}
          onClick={() => setIsCollapsed((prev) => !prev)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </aside>

      <main
        className={cn(
          "min-h-screen transition-[padding] duration-300",
          isCollapsed ? "lg:pl-20" : "lg:pl-64"
        )}
      >
        {children}
      </main>
    </div>
  );
}
