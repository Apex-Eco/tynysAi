'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { i18n, type Locale } from '@/lib/i18n/config';

const languageNames: Record<Locale, string> = {
  en: 'English',
  ru: 'Русский',
  kz: 'Қазақша',
};

function getLocaleFromPathname(pathname: string): Locale {
  const candidate = pathname.split('/')[1] as Locale | undefined;
  return i18n.locales.includes(candidate as Locale) ? (candidate as Locale) : i18n.defaultLocale;
}

export function LanguageSwitcher({ iconOnly = false }: { iconOnly?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  const currentLocale = getLocaleFromPathname(pathname);
  const englishActiveClass = "data-[state=checked]:bg-slate-950 data-[state=checked]:text-white data-[state=checked]:border data-[state=checked]:border-blue-900";

  const switchLocale = (newLocale: string) => {
    if (!pathname) return;

    // Replace the current locale in the pathname with the new one
    const segments = pathname.split('/');
    segments[1] = newLocale;
    const newPath = segments.join('/');

    // Set cookie and navigate
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.push(newPath);
    router.refresh();
  };

  const switchToNextLocale = () => {
    const currentIndex = i18n.locales.indexOf(currentLocale);
    const nextIndex = (currentIndex + 1) % i18n.locales.length;
    switchLocale(i18n.locales[nextIndex]);
  };

  if (iconOnly) {
    return (
      <Button
        variant="ghost"
        size="icon"
        onClick={switchToNextLocale}
        aria-label="Change language"
        title={`Language: ${languageNames[currentLocale]}`}
      >
        <Globe className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Globe className="h-4 w-4 text-muted-foreground" />
      <Select value={currentLocale} onValueChange={switchLocale}>
        <SelectTrigger className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-50">
          {i18n.locales.map((locale) => (
            <SelectItem key={locale} value={locale} className={locale === "en" ? englishActiveClass : undefined}>
              {languageNames[locale]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Simplified version for mobile/header
export function LanguageSwitcherCompact({ minimal = false }: { minimal?: boolean } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const currentLocale = getLocaleFromPathname(pathname);
  const isEnglish = currentLocale === "en";

  const getNextLocale = () => {
    const currentIndex = i18n.locales.indexOf(currentLocale);
    const nextIndex = (currentIndex + 1) % i18n.locales.length;
    return i18n.locales[nextIndex];
  };

  const switchToNextLocale = () => {
    const newLocale = getNextLocale();
    const segments = pathname.split('/');
    segments[1] = newLocale;
    const newPath = segments.join('/');

    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.push(newPath);
    router.refresh();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={switchToNextLocale}
      className={
        isEnglish
          ? "h-10 rounded-full border border-blue-900 bg-slate-950 px-3 text-white hover:bg-slate-900"
          : minimal
            ? "h-10 rounded-full border border-cyan-400/60 bg-cyan-500/15 px-3 text-cyan-100 hover:border-cyan-300 hover:bg-cyan-500/25"
            : "h-10 rounded-full border border-cyan-500/50 bg-cyan-600/15 px-3 text-cyan-100 hover:border-cyan-400 hover:bg-cyan-600/25"
      }
    >
      <Globe className="h-4 w-4" />
      <span className="font-medium">{languageNames[currentLocale]}</span>
    </Button>
  );
}
