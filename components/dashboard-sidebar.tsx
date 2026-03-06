"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { i18n } from "@/lib/i18n/config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Activity,
  Database,
  LogOut,
  Menu,
  X,
  BarChart3,
  TrendingUp,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

type DashboardSidebarProps = {
  user: {
    id: number;
    name: string;
    email: string;
    isAdmin: string;
  };
};

export function DashboardSidebar({ user }: DashboardSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const getUserInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const isAdmin = user.isAdmin === "true";

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

  const navigationItems = [
    {
      name: "Dashboard",
      icon: LayoutDashboard,
      href: "#overview",
      color: "text-blue-500",
    },
    ...(isAdmin
      ? [
          {
            name: "Users",
            icon: Users,
            href: "#users",
            color: "text-purple-500",
          },
          {
            name: "Contributors",
            icon: TrendingUp,
            href: "#contributors",
            color: "text-emerald-500",
          },
        ]
      : []),
    {
      name: "Analytics",
      icon: BarChart3,
      href: "#analytics-section",
      color: "text-amber-500",
    },
    {
      name: "Sensors",
      icon: Activity,
      href: "#sensors",
      color: "text-cyan-500",
    },
    {
      name: "Data",
      icon: Database,
      href: "#data",
      color: "text-pink-500",
    },
  ];

  const sidebarContent = (
    <div className="flex h-full flex-col bg-[hsl(var(--card))] text-[hsl(var(--foreground))] transition-colors">
      {/* Logo and Brand */}
      <div className={cn("border-b border-border p-6", isCollapsed && "p-4")}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-lg font-bold">Tynys</span>
                <span className="text-sm text-muted-foreground">
                  IoT Platform
                </span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* User Profile */}
      <div className={cn("border-b border-border p-6", isCollapsed && "p-4")}>
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 border-2 border-primary">
            <AvatarImage
              src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`}
            />
            <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-primary-foreground">
              {getUserInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold truncate">{user.name}</p>
                {isAdmin && (
                  <Badge variant="default" className="text-sm">
                    Admin
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navigationItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-base font-semibold transition-colors hover:bg-accent hover:text-accent-foreground text-[hsl(var(--foreground))]",
              isCollapsed && "justify-center"
            )}
          >
            <item.icon className={cn("h-5 w-5 flex-shrink-0", item.color)} />
            {!isCollapsed && <span className="font-mono">{item.name}</span>}
          </Link>
        ))}
      </nav>

      {/* Bottom Actions */}
      <div className="border-t border-border p-4 space-y-2">
        <button
          onClick={handleSignOut}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-base font-semibold text-destructive transition-colors hover:bg-destructive/10 w-full cursor-pointer",
            isCollapsed && "justify-center"
          )}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {!isCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 lg:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? (
          <X className="h-6 w-6" />
        ) : (
          <Menu className="h-6 w-6" />
        )}
      </Button>

      {/* Mobile Sidebar Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border bg-[hsl(var(--card))] text-[hsl(var(--foreground))] transition-transform duration-300 lg:hidden",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 hidden transform border-r border-border bg-[hsl(var(--card))] text-[hsl(var(--foreground))] transition-all duration-300 lg:block",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
