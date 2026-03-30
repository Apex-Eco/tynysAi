"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/HeroSection";
import HowItWorks from "@/components/how-it-works";
import { type Locale } from "@/lib/i18n/config";
import type { Session } from "next-auth";
import type { MapReading } from "@/components/air-quality-map";
import type { LatLngTuple } from "leaflet";
import {
  AIR_QUALITY_BENCHMARKS,
  AIR_QUALITY_BENCHMARKS_SUBTITLE,
  AIR_QUALITY_BENCHMARKS_TITLE,
} from "@/lib/air-quality-benchmarks";

type LiveSensorApiResponse = {
  readings?: MapReading[];
};

type LandingAirQualityMapProps = {
  readings: MapReading[];
  emptyStateText: string;
  emptyStateCtaLabel?: string;
  emptyStateCtaHref?: string;
  heightClass?: string;
  className?: string;
  showLanguageToggle?: boolean;
  useUserLocation?: boolean;
  showUserStatus?: boolean;
  interactive?: boolean;
  autoFitToData?: boolean;
  fixedCenter?: LatLngTuple;
  fixedZoom?: number;
};

type Dictionary = {
  nav: Record<string, string>;
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    description: string;
    getStarted: string;
    goToDashboard: string;
    learnMore: string;
  };
  heroPillars: {
    fewShot: string;
    optimization: string;
    structuredOutput: string;
    security: string;
  };
  metrics: Record<string, string>;
  dashboard: {
    low: string;
    high: string;
    [key: string]: string;
  };
  architecture: Record<string, string>;
  features: Record<string, string>;
  cta: Record<string, string>;
  footer: Record<string, string>;
  dashboardPage: Record<string, string>;
  signIn: Record<string, string>;
  signUp: Record<string, string>;
  navbar: Record<string, string>;
  howItWorks?: string;
  contact?: {
    talkToUs: string;
    header: string;
    tagline: string;
    emailLabel: string;
    messageLabel: string;
    send: string;
    sending: string;
  };
  crossPlatform?: {
    badge: string;
    title: string;
    description: string;
  };
  [key: string]: Record<string, string> | string | undefined;
};

const LandingAirQualityMap = dynamic<LandingAirQualityMapProps>(
  () => import("@/components/air-quality-map").then((mod) => mod.AirQualityMap),
  {
    ssr: false,
    loading: () => <div className="h-[260px] animate-pulse bg-slate-900/70 sm:h-[330px] md:h-[380px] lg:h-[460px]" />,
  },
);
const ALMATY_PREVIEW_CENTER: LatLngTuple = [43.2221, 76.8512];

const contributors = [
  { group: "Done by", name: "Farabi AGI Center", note: "Farabi AGI Center" },
  { group: "Done by", name: "Farabi AGI Center", note: "Farabi AGI Center" },
  { group: "Partner", name: "Farabi AGI Center", note: "Farabi AGI Center" },
  { group: "Partner", name: "Farabi AGI Center", note: "Farabi AGI Center" },
  { group: "Benchmark", name: "Farabi AGI Center", note: "Farabi AGI Center" },
  { group: "Partner", name: "Farabi AGI Center", note: "Farabi AGI Center" },
];

type BenchmarkMetricKey = "pm25" | "pm10";

function averageMetric(readings: MapReading[], metricKey: BenchmarkMetricKey): number | null {
  const values = readings
    .map((reading) => reading.mainReadings?.[metricKey])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return sum / values.length;
}

export function HomePage({
  dict,
  lang,
  session,
}: {
  dict: Dictionary;
  lang: Locale;
  session: Session | null;
}) {
  const [mapReadings, setMapReadings] = useState<MapReading[]>([]);
  const [isMapLoading, setIsMapLoading] = useState(true);
  const [hasFetchedMapData, setHasFetchedMapData] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let isActive = true;
    const pollMs = 10000;

    const fetchLiveReadings = async () => {
      try {
        const response = await fetch("/api/v1/sensor-data?public=1&latest=true", {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Failed with status ${response.status}`);
        }

        const payload = (await response.json()) as LiveSensorApiResponse;
        if (!isActive) return;

        const normalized = Array.isArray(payload.readings)
          ? payload.readings.filter(
              (reading) =>
                typeof reading.sensorId === "string"
                && typeof reading.location === "string"
                && Number.isFinite(reading.value),
            )
          : [];

        setMapReadings(normalized);
      } catch (error) {
        if (!isActive) return;
        console.error("Failed to fetch live map readings:", error);
      } finally {
        if (!isActive) return;
        setIsMapLoading(false);
        setHasFetchedMapData(true);
      }
    };

    void fetchLiveReadings();
    const intervalId = window.setInterval(() => {
      void fetchLiveReadings();
    }, pollMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchLiveReadings();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      isActive = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const benchmarkComparisons = useMemo(() => {
    const pm25Average = averageMetric(mapReadings, "pm25");
    const pm10Average = averageMetric(mapReadings, "pm10");

    return AIR_QUALITY_BENCHMARKS
      .filter((item) => item.averagingPeriod === "24-hour mean" && (item.pollutant === "PM2.5" || item.pollutant === "PM10"))
      .map((item) => {
        const value = item.pollutant === "PM2.5" ? pm25Average : pm10Average;
        const exceeds = typeof value === "number" ? value > item.guidelineValue : false;
        const delta = typeof value === "number" ? value - item.guidelineValue : null;

        return {
          ...item,
          currentValue: value,
          exceeds,
          delta,
        };
      });
  }, [mapReadings]);

  const heroEmptyText = "No device connected yet. Connect a device to see live air quality data.";
  const heroEmptyCta = "Contact setup support";
  const showMapLoadingState = isMapLoading && !hasFetchedMapData;
  const showMapEmptyState = !isMapLoading && hasFetchedMapData && mapReadings.length === 0;

  return (
    <div className="relative overflow-x-hidden bg-[#02050d] text-zinc-100">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_14%_6%,rgba(8,145,178,0.16),transparent_36%),radial-gradient(circle_at_84%_10%,rgba(14,116,144,0.18),transparent_40%),linear-gradient(180deg,#02050d_0%,#050a14_100%)]" />
        <svg className="absolute inset-0 h-full w-full opacity-35" viewBox="0 0 1200 1600" preserveAspectRatio="none">
          <defs>
            <linearGradient id="lowMotionLine" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(56,189,248,0)" />
              <stop offset="50%" stopColor="rgba(56,189,248,0.2)" />
              <stop offset="100%" stopColor="rgba(56,189,248,0)" />
            </linearGradient>
          </defs>
          <motion.g
            animate={{ x: [0, 10, 0], y: [0, -8, 0] }}
            transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
          >
            {Array.from({ length: 24 }).map((_, i) => (
              <line
                key={`grid-line-${i}`}
                x1="0"
                y1={i * 72}
                x2="1200"
                y2={i * 72 + (i % 2 === 0 ? 5 : -5)}
                stroke="url(#lowMotionLine)"
                strokeWidth="1"
              />
            ))}
          </motion.g>
        </svg>
      </div>

      <div className="relative z-50">
        <Navbar />
      </div>

      <div className="relative z-20 pb-8 sm:pb-10 lg:pb-12">
        <HeroSection
          session={session}
          dict={{ hero: dict.hero }}
          mapPreview={(
            <div className="relative overflow-hidden rounded-2xl border border-slate-800/80">
              <LandingAirQualityMap
                readings={mapReadings}
                emptyStateText={showMapEmptyState ? heroEmptyText : ""}
                emptyStateCtaLabel={showMapEmptyState ? heroEmptyCta : undefined}
                emptyStateCtaHref={showMapEmptyState ? `/${lang}/contact` : undefined}
                heightClass="h-[260px] sm:h-[330px] md:h-[380px] lg:h-[460px]"
                showLanguageToggle={false}
                useUserLocation={false}
                showUserStatus={false}
                interactive={false}
                autoFitToData={false}
                fixedCenter={ALMATY_PREVIEW_CENTER}
                fixedZoom={11}
                className="rounded-none"
              />
              {showMapLoadingState ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-slate-950/35 backdrop-blur-[1px]">
                  <div className="flex items-center gap-3 rounded-full border border-cyan-400/35 bg-slate-950/75 px-4 py-2 text-xs font-medium text-cyan-100">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-cyan-300/70 border-t-transparent" />
                    Loading live air quality...
                  </div>
                </div>
              ) : null}
            </div>
          )}
        />

        <HowItWorks dict={dict} />

        <section className="relative z-20 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
          <div className="mx-auto max-w-7xl rounded-3xl border border-cyan-400/20 bg-slate-900/60 p-5 md:p-6">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300">Reference</p>
                <h3 className="mt-1 text-xl font-semibold text-zinc-100 md:text-2xl">{AIR_QUALITY_BENCHMARKS_TITLE}</h3>
                <p className="mt-2 max-w-3xl text-sm text-slate-300">{AIR_QUALITY_BENCHMARKS_SUBTITLE}</p>
              </div>
            </div>

            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {benchmarkComparisons.map((item) => (
                <article
                  key={`comparison-${item.standardType}-${item.pollutant}`}
                  className="rounded-xl border border-slate-700/70 bg-slate-950/60 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-zinc-100">{item.pollutant} · {item.standardType}</p>
                    <p className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.exceeds ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                      {item.exceeds ? "Above threshold" : "Within threshold"}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Current sample mean</p>
                      <p className="font-mono text-sm text-zinc-100">
                        {typeof item.currentValue === "number" ? `${item.currentValue.toFixed(1)} ${item.unit}` : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-slate-500">Benchmark</p>
                      <p className="font-mono text-sm text-cyan-200">{item.guidelineValue} {item.unit}</p>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-slate-400">
                    {item.source} · {item.averagingPeriod}
                    {typeof item.delta === "number" ? ` · Δ ${item.delta >= 0 ? "+" : ""}${item.delta.toFixed(1)} ${item.unit}` : ""}
                  </p>
                </article>
              ))}
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/60">
              <div className="hidden grid-cols-[1fr_1fr_1fr_0.8fr_1.2fr] gap-2 border-b border-slate-800/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 md:grid">
                <p>Pollutant</p>
                <p>Averaging period</p>
                <p className="text-right">Threshold</p>
                <p className="text-right">Standard</p>
                <p className="text-right">Source</p>
              </div>
              <div className="divide-y divide-slate-800/70">
                {AIR_QUALITY_BENCHMARKS.map((benchmark) => (
                  <div
                    key={`${benchmark.pollutant}-${benchmark.averagingPeriod}-${benchmark.standardType}`}
                    className="grid grid-cols-1 gap-2 px-4 py-3 text-sm text-slate-200 md:grid-cols-[1fr_1fr_1fr_0.8fr_1.2fr] md:items-center"
                  >
                    <p className="font-semibold text-zinc-100">{benchmark.pollutant}</p>
                    <p>{benchmark.averagingPeriod}</p>
                    <p className="font-mono text-cyan-200 md:text-right">{benchmark.guidelineValue} {benchmark.unit}</p>
                    <p className="text-slate-300 md:text-right">{benchmark.standardType}</p>
                    <p className="text-slate-400 md:text-right">{benchmark.source}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="relative z-20 px-4 pb-14 pt-2 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-3xl border border-cyan-400/20 bg-slate-900/60 p-5 md:p-6">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300">Done By & Partners</p>
                <h3 className="mt-1 text-xl font-semibold text-zinc-100 md:text-2xl">Collaboration Strip</h3>
              </div>
              <p className="text-xs text-slate-400">Farabi AGI Center</p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/60 py-3">
              <motion.div
                className="flex w-max gap-3 px-3"
                animate={{ x: ["0%", "-50%"] }}
                transition={{ duration: 28, ease: "linear", repeat: Infinity }}
              >
                {[...contributors, ...contributors].map((item, idx) => (
                  <article
                    key={`${item.group}-${item.name}-${idx}`}
                    className="w-[240px] rounded-xl border border-slate-700/80 bg-slate-900/75 p-3"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan-300">{item.group}</p>
                    <p className="mt-1 text-sm font-semibold text-zinc-100">{item.name}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.note}</p>
                  </article>
                ))}
              </motion.div>
            </div>
          </div>
        </section>
      </div>

      <footer className="relative z-20 border-t border-slate-800 bg-slate-950 px-4 py-10 text-zinc-300 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-6 md:grid-cols-3">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <Image
                src="/tynys-logo.webp"
                alt="Tynys Logo"
                width={36}
                height={36}
                className="drop-shadow-lg"
              />
              <span className="text-xl font-bold text-zinc-100">TynysAi</span>
            </div>
            <p className="text-sm text-zinc-400">Live air quality intelligence for public transport.</p>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Contact</h3>
            <p className="text-sm">help@tynysai.kz</p>
            <p className="text-sm">Almaty, Kazakhstan</p>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Legal & Docs</h3>
            <div className="space-y-2 text-sm">
              <Link href={`/${lang}/privacy`} className="block hover:text-zinc-100">Privacy</Link>
              <Link href={`/${lang}/terms`} className="block hover:text-zinc-100">Terms</Link>
              <Link href={`/${lang}/read-docs`} className="block hover:text-zinc-100">Read Docs</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-6 max-w-7xl border-t border-slate-800 pt-4 text-xs text-zinc-500">
          <div className="text-center">© {new Date().getFullYear()} Tynys. {dict.footer.copyright}</div>
        </div>
      </footer>

    </div>
  );
}
