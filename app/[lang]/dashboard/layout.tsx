import { LanguageSwitcherCompact } from "@/components/language-switcher";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen w-full overflow-x-hidden">
      <div className="pointer-events-none fixed inset-x-0 top-4 z-40 flex justify-end px-3 sm:px-4">
        <div className="pointer-events-auto rounded-lg border border-cyan-400/30 bg-slate-950/80 p-1.5 shadow-xl backdrop-blur">
          <LanguageSwitcherCompact />
        </div>
      </div>
      {children}
    </div>
  );
}
