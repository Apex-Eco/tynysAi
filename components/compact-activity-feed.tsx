import { cn } from "@/lib/utils";

type ActivityItem = {
  id: string | number;
  sensorId: string;
  timestamp: string | Date | null;
};

type CompactActivityFeedProps = {
  items: ActivityItem[];
  title?: string;
  emptyText?: string;
  className?: string;
};

const formatActivityTimestamp = (timestamp: string | Date | null) => {
  if (!timestamp) return "just now";

  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  if (Number.isNaN(date.getTime())) return "just now";

  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
};

export function CompactActivityFeed({
  items,
  title,
  emptyText = "No activity yet.",
  className,
}: CompactActivityFeedProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-700 bg-slate-950 shadow-sm",
        "max-h-72 overflow-hidden",
        className
      )}
    >
      {title ? (
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Live
          </span>
        </div>
      ) : null}

      <div className="max-h-60 overflow-y-auto px-2 py-2">
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            {emptyText}
          </p>
        ) : (
          <div className="space-y-1.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="relative flex h-2 w-2 items-center justify-center">
                    <span
                      className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60"
                      aria-hidden
                    />
                    <span
                      className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"
                      aria-hidden
                    />
                    <span className="sr-only">Success</span>
                  </span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {item.sensorId}
                  </span>
                </div>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatActivityTimestamp(item.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
