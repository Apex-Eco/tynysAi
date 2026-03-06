"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { type Locale } from "@/lib/i18n/config";

type LangLayoutClientProps = {
  locale: Locale;
  children: ReactNode;
};

export function LangLayoutClient({ locale, children }: LangLayoutClientProps) {
  const pathname = usePathname();
  const isDashboardRoute = pathname?.includes("/dashboard") && Boolean(locale);

  if (isDashboardRoute) {
    return <div className="min-h-screen w-full overflow-x-hidden">{children}</div>;
  }

  return <div className="min-h-screen w-full overflow-x-hidden">{children}</div>;
}
