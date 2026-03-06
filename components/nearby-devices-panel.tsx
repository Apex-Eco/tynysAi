import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { NearbyDevice } from "@/lib/device-api";

type NearbyDevicesText = {
  title: string;
  locating: string;
  empty: string;
  error: string;
  kmAway: string;
  online: string;
  idle: string;
  offline: string;
};

interface NearbyDevicesPanelProps {
  devices: NearbyDevice[];
  loading: boolean;
  error: boolean;
  text: NearbyDevicesText;
  className?: string;
}

const STATUS_CLASS: Record<NearbyDevice["status"], string> = {
  online: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  idle: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  offline: "bg-slate-500/15 text-slate-300 border-slate-500/40",
};

export function NearbyDevicesPanel({
  devices,
  loading,
  error,
  text,
  className,
}: NearbyDevicesPanelProps) {
  const statusLabel = {
    online: text.online,
    idle: text.idle,
    offline: text.offline,
  } as const;

  return (
    <Card className={cn("border-slate-700/70 bg-slate-900/70", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-slate-100">{text.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? <p className="text-xs text-slate-300">{text.locating}</p> : null}

        {!loading && error ? <p className="text-xs text-slate-300">{text.error}</p> : null}

        {!loading && !error && devices.length === 0 ? (
          <p className="text-xs text-slate-300">{text.empty}</p>
        ) : null}

        {!loading && !error && devices.length > 0 ? (
          <div className="space-y-2">
            {devices.map((device) => (
              <div
                key={device.id}
                className="flex items-center justify-between gap-2 rounded-md border border-slate-700/70 bg-slate-950/60 px-2.5 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-100">{device.name}</p>
                  <p className="font-mono text-xs text-slate-300">
                    {device.distanceKm.toFixed(1)} {text.kmAway}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn("capitalize", STATUS_CLASS[device.status])}
                >
                  {statusLabel[device.status]}
                </Badge>
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
