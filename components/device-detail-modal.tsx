"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type DeviceDetailReading = {
  sensorId: string;
  value: number;
  timestamp?: string | null;
  mainReadings?: {
    pm1?: number;
    pm25?: number;
    pm10?: number;
    co2?: number;
    voc?: number;
    temperatureC?: number;
    humidityPct?: number;
    ch2o?: number;
    co?: number;
    o3?: number;
    no2?: number;
    pm1_0?: number;
    pm2_5?: number;
    pm_10?: number;
    PM1?: number;
    [key: string]: number | undefined;
  };
  pm1?: number;
  pm25?: number;
  pm10?: number;
  co2?: number;
  voc?: number;
  [key: string]: unknown;
};

export type DeviceDetails = {
  location: string;
  avgValue: number;
  latestValue: number;
  sampleCount: number;
  sensorIds: string[];
  readings: DeviceDetailReading[];
};

type DeviceDetailModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: DeviceDetails | null;
};

function formatTimestamp(timestamp?: string | null) {
  if (!timestamp) return "Not available";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString();
}

function numberOrDash(value?: number) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "-";
}

function resolveReadingMetric(reading: DeviceDetailReading, keys: string[]) {
  const fromMain = reading.mainReadings as Record<string, unknown> | undefined;
  const fromReading = reading as Record<string, unknown>;

  for (const key of keys) {
    const candidate = fromMain?.[key] ?? fromReading[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return candidate;
    }
    if (typeof candidate === "string" && candidate.trim() !== "") {
      const parsed = Number(candidate);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function sortByNewest(a: DeviceDetailReading, b: DeviceDetailReading) {
  const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
  const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
  return bTime - aTime;
}

function getIntensityRowClass(value: number) {
  if (!Number.isFinite(value)) return "bg-slate-950/40";
  if (value <= 12) return "bg-emerald-500/10";
  if (value <= 35.4) return "bg-lime-500/10";
  if (value <= 55.4) return "bg-amber-500/10";
  if (value <= 150.4) return "bg-orange-500/10";
  if (value <= 250.4) return "bg-red-500/10";
  return "bg-violet-500/10";
}

function LatestReadingsTable({ details }: { details: DeviceDetails }) {
  const latestThree = [...details.readings].sort(sortByNewest).slice(0, 3);

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-zinc-100">Latest 3 readings</h4>
      <div className="rounded-xl border border-slate-700/70 bg-slate-950/40">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700/70">
              <TableHead className="uppercase tracking-[0.08em] text-slate-400">Timestamp</TableHead>
              <TableHead className="text-right uppercase tracking-[0.08em] text-slate-400">AQI</TableHead>
              <TableHead className="text-right uppercase tracking-[0.08em] text-slate-400">PM2.5</TableHead>
              <TableHead className="text-right uppercase tracking-[0.08em] text-slate-400">PM10</TableHead>
              <TableHead className="text-right uppercase tracking-[0.08em] text-slate-400">CO2</TableHead>
              <TableHead className="text-right uppercase tracking-[0.08em] text-slate-400">Temp (°C)</TableHead>
              <TableHead className="text-right uppercase tracking-[0.08em] text-slate-400">Humidity (%)</TableHead>
              <TableHead className="uppercase tracking-[0.08em] text-slate-400">Site/Device ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {latestThree.map((reading, idx) => (
              <TableRow
                key={`latest-${reading.sensorId}-${reading.timestamp ?? idx}`}
                className={`border-slate-800/70 ${getIntensityRowClass(reading.value)}`}
              >
                <TableCell className="text-xs text-slate-200">{formatTimestamp(reading.timestamp)}</TableCell>
                <TableCell className="text-right font-mono text-xs text-zinc-100">{reading.value.toFixed(1)}</TableCell>
                <TableCell className="text-right font-mono text-xs text-zinc-100">{numberOrDash(resolveReadingMetric(reading, ["pm25", "pm2_5", "PM2.5", "PM25", "pm_2_5"]))}</TableCell>
                <TableCell className="text-right font-mono text-xs text-zinc-100">{numberOrDash(resolveReadingMetric(reading, ["pm10", "pm_10", "PM10"]))}</TableCell>
                <TableCell className="text-right font-mono text-xs text-zinc-100">{numberOrDash(resolveReadingMetric(reading, ["co2", "CO2", "co_2"]))}</TableCell>
                <TableCell className="text-right font-mono text-xs text-zinc-100">{numberOrDash(resolveReadingMetric(reading, ["temperatureC", "temperature", "temp", "TEMP"]))}</TableCell>
                <TableCell className="text-right font-mono text-xs text-zinc-100">{numberOrDash(resolveReadingMetric(reading, ["humidityPct", "humidity", "hum", "HUM"]))}</TableCell>
                <TableCell className="text-xs font-medium text-zinc-100">{reading.sensorId}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function DeviceDetailModal({ open, onOpenChange, details }: DeviceDetailModalProps) {
  if (!details) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl">Device details</DialogTitle>
          <DialogDescription>Latest sensor data in a compact intensity table.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 rounded-xl border border-slate-700/70 bg-slate-950/50 p-4 sm:grid-cols-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Location</p>
            <p className="mt-1 text-sm text-zinc-100">{details.location}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Device count</p>
            <p className="mt-1 text-sm text-zinc-100 font-mono">{details.sensorIds.length}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Average AQI</p>
            <p className="mt-1 text-sm text-zinc-100 font-mono">{details.avgValue.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Latest AQI</p>
            <p className="mt-1 text-sm text-zinc-100 font-mono">{details.latestValue.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-400">Samples</p>
            <p className="mt-1 text-sm text-zinc-100 font-mono">{details.sampleCount}</p>
          </div>
        </div>

        <LatestReadingsTable details={details} />
      </DialogContent>
    </Dialog>
  );
}
