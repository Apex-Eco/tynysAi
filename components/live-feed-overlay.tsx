"use client";

import { useState } from "react";
import { Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CompactActivityFeed } from "@/components/compact-activity-feed";

export type LiveFeedItem = {
  id: number | string;
  sensorId: string;
  timestamp: Date | string | null;
};

interface LiveFeedOverlayProps {
  title?: string;
  emptyText?: string;
  items: LiveFeedItem[];
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

export function LiveFeedOverlay({
  title = "Live Feed",
  emptyText = "No recent activity",
  items,
  onOpenChange,
}: LiveFeedOverlayProps) {
  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900 px-4 pr-5 text-slate-100 shadow-lg hover:bg-slate-800"
        >
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/80" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          <Activity className="h-4 w-4" />
          <span className="whitespace-nowrap text-sm font-semibold">Recent IoT Data</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="z-50 w-[320px] p-0 sm:w-[360px]"
      >
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <CompactActivityFeed
          emptyText={emptyText}
          items={items}
          className="rounded-none border-0"
        />
      </PopoverContent>
    </Popover>
  );
}
