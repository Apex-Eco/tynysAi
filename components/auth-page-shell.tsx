"use client";

import { useEffect, useRef, type ReactNode } from "react";

interface AuthPageShellProps {
  children: ReactNode;
}

export function AuthPageShell({ children }: AuthPageShellProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncRate = () => {
      video.playbackRate = 1;
    };

    syncRate();
    video.addEventListener("loadedmetadata", syncRate);
    return () => video.removeEventListener("loadedmetadata", syncRate);
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          src="/media/19079374-uhd_3840_2160_25fps.mp4"
          muted
          loop
          playsInline
          autoPlay
          preload="auto"
          aria-hidden
        />
        <div className="absolute inset-0 bg-slate-950 sm:bg-gradient-to-b sm:from-background/50 sm:via-background/70 sm:to-background/85" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
