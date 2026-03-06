"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps as RechartsTooltipProps,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SensorReading {
  id?: number;
  timestamp: string;
  sensorId: string;
  value: number;
  location?: string | null;
  transportType?: string | null;
  ingestedAt?: Date;
}

interface AqiAreaChartProps {
  data: SensorReading[];
  className?: string;
}

const chartTimestampFormatter = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : `${chartTimestampFormatter.format(date)} UTC`;
};

type AqiTooltipPayload = {
  value?: number;
  payload?: SensorReading;
};

type AqiTooltipProps = RechartsTooltipProps<number, string> & {
  payload?: AqiTooltipPayload[];
  label?: string | number;
  active?: boolean;
};

function AqiTooltip({ active, payload, label }: AqiTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const point = payload[0];
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-3 space-y-2">
        <div className="text-xs text-muted-foreground">{formatTimestamp(label as string)}</div>
        <div className="text-sm font-medium">AQI {point.value?.toFixed(2)}</div>
        {point.payload?.sensorId && (
          <div className="text-xs text-muted-foreground">Sensor {point.payload.sensorId}</div>
        )}
      </CardContent>
    </Card>
  );
}

export function AqiAreaChart({ data, className }: AqiAreaChartProps) {
  const chartData = useMemo(
    () =>
      data
        .map((reading) => ({
          ...reading,
          label: formatTimestamp(reading.timestamp),
        }))
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ),
    [data]
  );

  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.max(...chartData.map((d) => d.value));
  }, [chartData]);

  const gradientMax = Math.max(maxValue, 150);
  const stops = [
    { offset: 0, color: "#16a34a" }, // green
    { offset: Math.min((50 / gradientMax) * 100, 100), color: "#84cc16" }, // yellow-green
    { offset: Math.min((100 / gradientMax) * 100, 100), color: "#f59e0b" }, // amber
    { offset: Math.min((150 / gradientMax) * 100, 100), color: "#ef4444" }, // red
    { offset: 100, color: "#b91c1c" }, // deep red tail
  ];

  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={360}>
        <AreaChart data={chartData} margin={{ top: 10, right: 24, left: 12, bottom: 16 }}>
          <defs>
            {/* Gradient shifts from green to red as values rise */}
            <linearGradient
              id="aqiGradient"
              x1="0"
              y1="0"
              x2="0"
              y2={gradientMax || 1}
              gradientUnits="userSpaceOnUse"
            >
              {stops.map((stop, idx) => (
                <stop
                  key={idx}
                  offset={`${stop.offset}%`}
                  stopColor={stop.color}
                  stopOpacity={0.6}
                />
              ))}
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            angle={-35}
            textAnchor="end"
            height={80}
            stroke="hsl(var(--border))"
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))" }}
            stroke="hsl(var(--border))"
            label={{
              value: "AQI",
              angle: -90,
              position: "insideLeft",
              style: { fill: "hsl(var(--muted-foreground))" },
            }}
          />
          <Tooltip content={<AqiTooltip />} />
          <Legend />
          <Area
            type="monotone"
            dataKey="value"
            name="AQI"
            stroke="rgb(59, 130, 246)"
            strokeWidth={2}
            fill="url(#aqiGradient)"
            dot={{ r: 3, strokeWidth: 1, stroke: "white" }}
            activeDot={{ r: 5, fill: "rgb(59, 130, 246)" }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
