"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { Session } from "next-auth";
import type { MapReading } from "@/components/air-quality-map";

type AirQualityMapProps = {
  readings: MapReading[];
  emptyStateText: string;
  heightClass?: string;
  className?: string;
  showLegend?: boolean;
};

const AirQualityMap = dynamic<AirQualityMapProps>(
  () => import("@/components/air-quality-map").then((mod) => mod.AirQualityMap),
  {
    ssr: false,
    loading: () => <div className="h-[320px] animate-pulse bg-slate-900/70 sm:h-[380px] lg:h-[460px]" />,
  },
);

type HeroSectionProps = {
  session: Session | null;
  mapReadings: MapReading[];
  dict: {
    hero: {
      badge: string;
      title: string;
      subtitle: string;
      description: string;
      getStarted: string;
      goToDashboard: string;
      learnMore: string;
    };
  };
};

export function HeroSection({ session, mapReadings, dict }: HeroSectionProps) {
  return (
    <section className="relative z-20 px-4 pb-8 pt-20 sm:px-6 sm:pb-10 sm:pt-24 lg:px-8 lg:pb-12 lg:pt-28" id="hero">
      <div className="mx-auto grid min-h-[calc(100svh-5rem)] w-full max-w-7xl content-center gap-8 sm:min-h-[calc(100dvh-5.5rem)] lg:min-h-[calc(100dvh-6rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-10">
        <div className="text-left lg:pr-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" />
            {dict.hero.badge}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-5 max-w-2xl text-3xl font-bold leading-tight tracking-[-0.02em] text-white sm:text-5xl lg:text-6xl"
          >
            <span className="bg-gradient-to-r from-cyan-200 via-sky-300 to-blue-300 bg-clip-text text-transparent">
              {dict.hero.title}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base"
          >
            {dict.hero.description}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-7 grid w-full max-w-xl gap-3 sm:grid-cols-3"
          >
            <div className="rounded-xl border border-cyan-400/30 bg-slate-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Sampling</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">Every 60s</p>
            </div>
            <div className="rounded-xl border border-cyan-400/30 bg-slate-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Coverage</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">Bus, Metro, Trolley</p>
            </div>
            <div className="rounded-xl border border-cyan-400/30 bg-slate-950/70 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Access</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">
                {session ? "Dashboard Ready" : "Public Preview"}
              </p>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 }}
          className="rounded-3xl border border-cyan-400/20 bg-slate-950/70 p-2 shadow-[0_16px_54px_rgba(8,47,73,0.45)] backdrop-blur-xl"
        >
          <div className="overflow-hidden rounded-2xl border border-slate-800/80">
            <AirQualityMap
              readings={mapReadings}
              emptyStateText="No geocoded route data yet."
              heightClass="h-[260px] sm:h-[330px] md:h-[380px] lg:h-[460px]"
              className="rounded-none border-0"
              showLegend={false}
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
