"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  ChevronLeft,
  LayoutDashboard,
  Menu,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { i18n, type Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

const NAV_WIDTH = {
  expanded: "w-64",
  collapsed: "w-20",
};

type SidebarLayoutProps = {
  locale: Locale;
  children: ReactNode;
};

type SidebarItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  children?: { label: string; href: string; anchorId?: string }[];
};

const SECTION_ANCHORS = ["map-view", "particulate-metrics", "analytics", "reports"];

type SidebarCSSVars = CSSProperties & {
  "--sidebar-width"?: string;
  "--sidebar-padding"?: string;
};

export function SidebarLayout({ locale, children }: SidebarLayoutProps) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const { data: session, status } = useSession();

  const safeLocale = (i18n.locales as readonly string[]).includes(locale)
    ? locale
    : i18n.defaultLocale;

  const navItems = useMemo<SidebarItem[]>(() => {
    return [
      {
        label: "Dashboard",
        href: `/${safeLocale}/dashboard`,
        icon: LayoutDashboard,
        children: [
          {
            label: "Map Overview",
            href: `#${SECTION_ANCHORS[0]}`,
            anchorId: SECTION_ANCHORS[0],
          },
          {
            label: "Air Composition",
            href: `#${SECTION_ANCHORS[1]}`,
            anchorId: SECTION_ANCHORS[1],
          },
          {
            label: "Analytics Trends",
            href: `#${SECTION_ANCHORS[2]}`,
            anchorId: SECTION_ANCHORS[2],
          },
          {
            label: "Reports",
            href: `#${SECTION_ANCHORS[3]}`,
            anchorId: SECTION_ANCHORS[3],
          },
        ],
      },
    ];
  }, [safeLocale]);

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(`${href}/`);

  const getUserInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const scrollToSection = useCallback((anchorId: string) => {
    const el = document.getElementById(anchorId);
    if (!el) return;

    const offset = 88;
    const target = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: target, behavior: "smooth" });
    setActiveSection(anchorId);
  }, []);

  const handleSignOut = () => signOut({ callbackUrl: `/${safeLocale}` });

  useEffect(() => {
    if (!pathname?.startsWith(`/${safeLocale}/dashboard`)) {
      setActiveSection(null);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target?.id) {
          setActiveSection(visible.target.id);
        }
      },
      {
        rootMargin: "-35% 0px -45% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    const sections = SECTION_ANCHORS.map((id) => document.getElementById(id)).filter(
      Boolean
    ) as HTMLElement[];

    sections.forEach((section) => observer.observe(section));

    return () => {
      sections.forEach((section) => observer.unobserve(section));
    };
  }, [pathname, safeLocale]);

  const handleAnchorClick = (
    event: MouseEvent<HTMLAnchorElement>,
    anchorId?: string,
    fallbackHref?: string
  ) => {
    if (!anchorId) return;

    event.preventDefault();

    if (!pathname?.startsWith(`/${safeLocale}/dashboard`)) {
      window.location.href = fallbackHref || `/${safeLocale}/dashboard#${anchorId}`;
      return;
    }

    scrollToSection(anchorId);
  };

  const renderSidebarContent = (compact: boolean) => (
    <div className="flex h-full flex-col bg-[hsl(var(--card))] text-sm text-[hsl(var(--foreground))] transition-colors">
      <div className="border-b border-border px-4 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-card ring-1 ring-border">
              <Image
                src="/tynys-logo.webp"
                alt="TynysAi logo"
                width={44}
                height={44}
                className="h-10 w-10 object-contain"
                priority
              />
            </div>
            {!compact && (
              <div>
                <p className="text-base font-semibold tracking-tight text-foreground">TynysAi</p>
                <p className="text-xs text-muted-foreground">Air Quality Control</p>
              </div>
            )}
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="hidden lg:flex text-muted-foreground hover:bg-muted"
            onClick={() => setIsCollapsed((prev) => !prev)}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <div key={item.href} className="space-y-1">
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted",
                isActive(item.href)
                  ? "bg-muted text-foreground ring-1 ring-border"
                  : "text-muted-foreground",
                compact && "justify-center"
              )}
            >
              <item.icon className="h-5 w-5" />
              {!compact && (
                <div className="flex flex-1 items-center justify-between">
                  <div className="flex flex-col">
                    <span className="font-mono text-base font-medium">{item.label}</span>
                  </div>
                  {item.badge && (
                    <Badge variant="outline" className="border-border text-xs text-foreground">
                      {item.badge}
                    </Badge>
                  )}
                </div>
              )}
            </Link>

            {!compact && item.children?.length ? (
              <div className="mt-1 space-y-1 pl-4">
                {item.children.map((child) => (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={(event) =>
                      handleAnchorClick(
                        event,
                        child.anchorId,
                        child.anchorId ? `${item.href}#${child.anchorId}` : item.href
                      )
                    }
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:text-foreground text-muted-foreground",
                      child.anchorId && activeSection === child.anchorId && "text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full bg-current transition-opacity opacity-60",
                        child.anchorId && activeSection === child.anchorId && "opacity-100"
                      )}
                    />
                    <span className="font-mono">{child.label}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </nav>
    </div>
  );

  const sidebarStyles = useMemo<SidebarCSSVars>(() => {
    return {
      "--sidebar-width": isCollapsed ? "80px" : "256px",
      "--sidebar-padding": isCollapsed ? "1.5rem" : "2.5rem",
    };
  }, [isCollapsed]);

  return (
    <div className="sidebar-layout relative flex min-h-screen overflow-x-hidden bg-background text-foreground transition-colors">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden lg:block">
        <motion.div
          initial={false}
          animate={{ width: isCollapsed ? NAV_WIDTH.collapsed : NAV_WIDTH.expanded }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
          className={cn(
            "h-full overflow-hidden border-r border-border bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-2xl transition-colors",
          )}
        >
          {renderSidebarContent(isCollapsed)}
        </motion.div>
      </aside>

      {/* Mobile sidebar */}
      <div className="sticky top-2 z-40 px-4 pt-4 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Open sidebar">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Navigation</SheetTitle>
            </SheetHeader>
            {renderSidebarContent(false)}
          </SheetContent>
        </Sheet>
      </div>

      <main
        className={cn(
          "flex min-h-screen flex-1 flex-col overflow-x-hidden transition-[margin-left,padding-left,width] duration-300 bg-background",
          "lg:ml-[var(--sidebar-width)] lg:pl-[var(--sidebar-padding)]"
        )}
        style={sidebarStyles}
      >
        <header className="sticky top-0 z-30 flex items-center justify-end gap-3 border-b border-slate-700 bg-slate-950 px-4 py-2 transition-colors">
          <LanguageSwitcher iconOnly />
          {status === "authenticated" && session?.user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 px-2">
                  <Avatar className="h-8 w-8 border border-slate-700">
                    <AvatarImage
                      src={
                        session.user.image ||
                        `https://api.dicebear.com/7.x/initials/svg?seed=${session.user.name || session.user.email}`
                      }
                      alt={session.user.name || "User avatar"}
                    />
                    <AvatarFallback className="bg-slate-700 text-slate-100">
                      {session.user.name
                        ? getUserInitials(session.user.name)
                        : session.user.email?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {session.user.name || "User"}
                    </p>
                    <p className="text-xs text-muted-foreground leading-none">
                      {session.user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-red-600 hover:text-red-700 focus:text-red-700"
                  onClick={handleSignOut}
                >
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="flex items-center gap-2">
              <Link href={`/${safeLocale}/sign-in`}>
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </Link>
              <Link href={`/${safeLocale}/sign-up`}>
                <Button size="sm" className="bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-visible">
          <div className="h-full overflow-auto px-4 pb-8 pt-2">{children}</div>
        </div>
      </main>
    </div>
  );
}

export default SidebarLayout;
