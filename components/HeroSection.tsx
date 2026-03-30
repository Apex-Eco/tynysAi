"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { Session } from "next-auth";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

type HeroSectionProps = {
  session: Session | null;
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

export function HeroSection({ session, dict }: HeroSectionProps) {
  const [isDemoOpen, setIsDemoOpen] = useState(false);
  const [demoMessage, setDemoMessage] = useState("");

  const sendDemoRequest = () => {
    const subject = encodeURIComponent("TynysAi Demo Request");
    const body = encodeURIComponent(
      `Hello TynysAi team,%0D%0A%0D%0A${demoMessage.trim() || "I would like to request a demo."}%0D%0A%0D%0AThanks.`,
    );
    window.location.href = `mailto:help@tynysai.kz?subject=${subject}&body=${body}`;
    setIsDemoOpen(false);
    setDemoMessage("");
  };

  return (
    <section className="relative z-20 px-4 pb-8 pt-20 sm:px-6 sm:pb-10 sm:pt-24 lg:px-8 lg:pb-12 lg:pt-28" id="hero">
      <div className="mx-auto grid min-h-[calc(100svh-5rem)] w-full max-w-7xl content-center gap-8 sm:min-h-[calc(100dvh-5.5rem)] lg:min-h-[calc(100dvh-6rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:items-center lg:gap-10">
        <div className="text-left lg:pr-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="hidden items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-500/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200 sm:inline-flex"
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-5 flex flex-wrap gap-3"
          >
            <Button
              type="button"
              onClick={() => setIsDemoOpen(true)}
              className="bg-cyan-500 text-slate-950 hover:bg-cyan-400"
            >
              Request a demo
            </Button>
            <a
              href="#how-it-works"
              className="inline-flex items-center rounded-md border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-800"
            >
              {dict.hero.learnMore}
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-7 grid w-full max-w-xl gap-3 sm:grid-cols-3"
          >
            <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Sampling</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">Every 60s</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Coverage</p>
              <p className="mt-1 text-sm font-semibold text-zinc-100">Bus, Metro, Trolley</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
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
          className="rounded-3xl border border-slate-700 bg-slate-950 p-2 shadow-2xl"
        >
          <div className="relative h-[260px] overflow-hidden rounded-2xl sm:h-[330px] md:h-[380px] lg:h-[460px]">
            <Image
              src="/herosection.jpg"
              alt="Tynys AI air quality map — Almaty"
              fill
              priority
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-black/20" />
          </div>
        </motion.div>
      </div>

      <Dialog open={isDemoOpen} onOpenChange={setIsDemoOpen}>
        <DialogContent className="border-slate-700 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Request a demo</DialogTitle>
            <DialogDescription className="text-slate-300">
              Share a short message and we will draft an email to help@tynysai.kz.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={demoMessage}
            onChange={(event) => setDemoMessage(event.target.value)}
            placeholder="Tell us about your fleet size, city, and timeline."
            className="min-h-[140px] border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-400"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDemoOpen(false)} className="border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800">
              Cancel
            </Button>
            <Button type="button" onClick={sendDemoRequest} className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
              Send email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
