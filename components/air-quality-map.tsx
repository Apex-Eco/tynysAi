"use client";

import { useEffect, useMemo, useState } from "react";
import { Circle, CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import L from "leaflet";
import { usePathname } from "next/navigation";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import { DeviceDetailModal, type DeviceDetails } from "@/components/device-detail-modal";

export type MapReading = {
  location?: string | null;
  value: number;
  timestamp?: string | null;
  sensorId: string;
  mainReadings?: {
    pm25?: number;
    pm10?: number;
    co2?: number;
    temperatureC?: number;
    humidityPct?: number;
  };
};

type AqiKey = "good" | "moderate" | "usg" | "unhealthy" | "veryUnhealthy" | "hazardous";

const AQI_BREAKPOINTS = [
  { key: "good" as AqiKey, limit: 12, color: "#22c55e", range: "0-50" },
  { key: "moderate" as AqiKey, limit: 35.4, color: "#84cc16", range: "51-100" },
  { key: "usg" as AqiKey, limit: 55.4, color: "#eab308", range: "101-150" },
  { key: "unhealthy" as AqiKey, limit: 150.4, color: "#f97316", range: "151-200" },
  { key: "veryUnhealthy" as AqiKey, limit: 250.4, color: "#ef4444", range: "201-300" },
  { key: "hazardous" as AqiKey, limit: Infinity, color: "#7e22ce", range: "300+" },
] as const;

const DEFAULT_CENTER: LatLngTuple = [37.0902, -95.7129];

const MAP_TEXT: Record<
  "en" | "ru" | "kz",
  {
    good: string;
    moderate: string;
    usg: string;
    unhealthy: string;
    veryUnhealthy: string;
    hazardous: string;
    avg: string;
    latest: string;
    samples: string;
    nearbyAqi: string;
    locating: string;
    kmAway: string;
    userLocation: string;
  }
> = {
  en: {
    good: "Good",
    moderate: "Moderate",
    usg: "USG",
    unhealthy: "Unhealthy",
    veryUnhealthy: "Very Unhealthy",
    hazardous: "Hazardous",
    avg: "Avg",
    latest: "Latest",
    samples: "Samples",
    nearbyAqi: "Nearby AQI",
    locating: "Locating...",
    kmAway: "km away",
    userLocation: "Your location",
  },
  ru: {
    good: "Хорошо",
    moderate: "Умеренно",
    usg: "USG",
    unhealthy: "Нездорово",
    veryUnhealthy: "Очень нездорово",
    hazardous: "Опасно",
    avg: "Средн.",
    latest: "Послед.",
    samples: "Образцы",
    nearbyAqi: "AQI рядом",
    locating: "Определяем...",
    kmAway: "км",
    userLocation: "Ваше местоположение",
  },
  kz: {
    good: "Жақсы",
    moderate: "Орташа",
    usg: "USG",
    unhealthy: "Зиянды",
    veryUnhealthy: "Өте зиянды",
    hazardous: "Қауіпті",
    avg: "Орташа",
    latest: "Соңғы",
    samples: "Үлгілер",
    nearbyAqi: "Жақын AQI",
    locating: "Анықталуда...",
    kmAway: "км",
    userLocation: "Сіздің орныңыз",
  },
};

function parseLocation(location?: string | null): LatLngTuple | null {
  if (!location) return null;
  const [latStr, lngStr] = location.split(",").map((part) => part.trim());
  const lat = Number(latStr);
  const lng = Number(lngStr);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;

  return [lat, lng];
}

type AggregatedPoint = {
  key: string;
  coords: LatLngTuple;
  count: number;
  avgValue: number;
  latestValue: number;
  lastTimestamp: string | null;
  sensorIds: string[];
  readings: MapReading[];
};

function normalizeTimestamp(timestamp?: string | null): string | null {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function aggregatePoints(readings: MapReading[]): AggregatedPoint[] {
  const map = new Map<string, AggregatedPoint>();

  readings.forEach((reading) => {
    const coords = parseLocation(reading.location);
    if (!coords) return;

    const key = reading.location!.trim();
    const existing = map.get(key);
    const timestamp = normalizeTimestamp(reading.timestamp);

    if (!existing) {
      map.set(key, {
        key,
        coords,
        count: 1,
        avgValue: reading.value,
        latestValue: reading.value,
        lastTimestamp: timestamp,
        sensorIds: [reading.sensorId],
        readings: [reading],
      });
      return;
    }

    const count = existing.count + 1;
    const avgValue = (existing.avgValue * existing.count + reading.value) / count;
    const isNewer =
      !existing.lastTimestamp
      || (Boolean(timestamp) && (timestamp as string) > existing.lastTimestamp);

    const sensorIds = existing.sensorIds.includes(reading.sensorId)
      ? existing.sensorIds
      : [...existing.sensorIds, reading.sensorId];

    map.set(key, {
      ...existing,
      count,
      avgValue,
      latestValue: isNewer ? reading.value : existing.latestValue,
      lastTimestamp: isNewer ? timestamp : existing.lastTimestamp,
      sensorIds,
      readings: [...existing.readings, reading],
    });
  });

  return Array.from(map.values());
}

function getAqiStyle(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  return AQI_BREAKPOINTS.find((b) => safeValue <= b.limit) ?? AQI_BREAKPOINTS[AQI_BREAKPOINTS.length - 1];
}

function createNumericIcon(value: number, color: string) {
  return L.divIcon({
    className: "aqi-number-icon",
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 9999px;
        background: ${color};
        border: 2px solid rgba(15, 23, 42, 0.9);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
      ">${Math.round(value)}</div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

function FitToMarkers({
  points,
  userLocation,
  useUserLocation,
}: {
  points: AggregatedPoint[];
  userLocation: LatLngTuple | null;
  useUserLocation: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const coords = points.map((p) => p.coords);
    if (useUserLocation && userLocation) {
      coords.push(userLocation);
    }

    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 12);
      return;
    }

    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: useUserLocation ? 13 : 12 });
  }, [map, points, userLocation, useUserLocation]);

  return null;
}

export function AirQualityMap({
  readings,
  emptyStateText,
  heightClass = "h-[420px]",
  className,
  showLegend = true,
  useUserLocation = false,
  showUserStatus = false,
}: {
  readings: MapReading[];
  emptyStateText: string;
  heightClass?: string;
  className?: string;
  showLegend?: boolean;
  useUserLocation?: boolean;
  showUserStatus?: boolean;
}) {
  const pathname = usePathname();
  const pathnameLocale = (pathname?.split("/")[1] ?? "en") as "en" | "ru" | "kz";
  const locale = pathnameLocale === "ru" || pathnameLocale === "kz" ? pathnameLocale : "en";
  const text = MAP_TEXT[locale];

  const points = useMemo(() => aggregatePoints(readings), [readings]);
  const [userLocation, setUserLocation] = useState<LatLngTuple | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceDetails | null>(null);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);

  const center = useMemo<LatLngTuple>(() => {
    if (points.length === 0) return DEFAULT_CENTER;
    const [latSum, lngSum] = points.reduce(
      (acc, point) => [acc[0] + point.coords[0], acc[1] + point.coords[1]],
      [0, 0],
    );
    return [latSum / points.length, lngSum / points.length];
  }, [points]);

  useEffect(() => {
    if (!useUserLocation || typeof window === "undefined" || !("geolocation" in navigator)) {
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        setIsLocating(false);
      },
      () => {
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );
  }, [useUserLocation]);

  const nearestAqi = useMemo(() => {
    if (!userLocation || points.length === 0) return null;

    let best: AggregatedPoint | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const point of points) {
      const dLat = point.coords[0] - userLocation[0];
      const dLng = point.coords[1] - userLocation[1];
      const dist = dLat * dLat + dLng * dLng;
      if (dist < bestDist) {
        bestDist = dist;
        best = point;
      }
    }

    if (!best) return null;
    const category = getAqiStyle(best.avgValue);
    const distanceKm = Math.sqrt(bestDist) * 111;
    return {
      value: best.avgValue,
      color: category.color,
      label: text[category.key],
      distanceKm,
    };
  }, [userLocation, points, text]);

  if (points.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-dashed border-slate-800/60 text-sm text-muted-foreground",
          heightClass,
        )}
      >
        {emptyStateText}
      </div>
    );
  }

  return (
    <>
      <div
        className={cn(
          "relative flex h-full flex-col rounded-lg bg-background",
          heightClass,
          className,
        )}
      >
        {showLegend ? (
          <div className="relative flex flex-wrap items-center gap-3 border-b border-slate-800/60 bg-background/80 px-3 py-2">
            <LegendBar text={text} />
          </div>
        ) : null}

        {showUserStatus ? (
          <div className="absolute left-3 top-3 z-[500]">
            <div className="rounded-lg border border-slate-700/80 bg-slate-950/90 px-3 py-2 text-xs text-slate-200 shadow-lg">
              <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{text.nearbyAqi}</p>
              {isLocating ? (
                <p className="mt-1 text-slate-200">{text.locating}</p>
              ) : nearestAqi ? (
                <p className="mt-1 font-semibold" style={{ color: nearestAqi.color }}>
                  {Math.round(nearestAqi.value)} · {nearestAqi.label} · {nearestAqi.distanceKm.toFixed(1)} {text.kmAway}
                </p>
              ) : (
                <p className="mt-1 text-slate-300">—</p>
              )}
            </div>
          </div>
        ) : null}

        <div className={cn("relative flex-1 overflow-hidden", showLegend ? "rounded-b-lg" : "rounded-lg")}>
          <MapContainer
            center={center}
            zoom={6}
            scrollWheelZoom={true}
            touchZoom={true}
            dragging={true}
            zoomControl={true}
            preferCanvas
            fadeAnimation={false}
            zoomAnimation={false}
            markerZoomAnimation={false}
            className="h-full w-full bg-background"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitToMarkers points={points} userLocation={userLocation} useUserLocation={useUserLocation} />

            {points.map((point) => {
              const aqi = getAqiStyle(point.avgValue);
              return (
                <Marker
                  key={point.key}
                  position={point.coords}
                  icon={createNumericIcon(point.avgValue, aqi.color)}
                  eventHandlers={{
                    click: () => {
                      const sortedReadings = [...point.readings].sort((a, b) => {
                        const aTs = normalizeTimestamp(a.timestamp);
                        const bTs = normalizeTimestamp(b.timestamp);
                        if (!aTs && !bTs) return 0;
                        if (!aTs) return 1;
                        if (!bTs) return -1;
                        return bTs.localeCompare(aTs);
                      });

                      setSelectedDevice({
                        location: point.key,
                        avgValue: point.avgValue,
                        latestValue: point.latestValue,
                        sampleCount: point.count,
                        sensorIds: point.sensorIds,
                        readings: sortedReadings,
                      });
                      setIsDeviceModalOpen(true);
                    },
                  }}
                >
                  <Popup>
                    <div className="space-y-1 text-xs">
                      <p className="font-semibold">{point.key}</p>
                      <p>{text.avg}: {point.avgValue.toFixed(1)}</p>
                      <p>{text.latest}: {point.latestValue.toFixed(1)}</p>
                      <p>{text.samples}: {point.count}</p>
                      <p className="pt-1 text-[11px] text-slate-500">Click marker for full device data</p>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {userLocation ? (
              <>
                <Circle center={userLocation} radius={1000} pathOptions={{ color: "#38bdf8", weight: 1, fillOpacity: 0.08 }} />
                <CircleMarker
                  center={userLocation}
                  radius={7}
                  pathOptions={{ color: "#38bdf8", fillColor: "#38bdf8", fillOpacity: 1, weight: 2 }}
                >
                  <Popup>{text.userLocation}</Popup>
                </CircleMarker>
              </>
            ) : null}
          </MapContainer>
        </div>
      </div>
      <DeviceDetailModal
        open={isDeviceModalOpen}
        onOpenChange={setIsDeviceModalOpen}
        details={selectedDevice}
      />
    </>
  );
}

function LegendBar({ text }: { text: Record<AqiKey, string> & Record<string, string> }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {AQI_BREAKPOINTS.map((level) => (
        <div
          key={level.key}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-2.5 py-1"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: level.color }} aria-hidden />
          <span className="font-medium text-foreground">{text[level.key]}</span>
          <span className="text-muted-foreground">({level.range})</span>
        </div>
      ))}
    </div>
  );
}
