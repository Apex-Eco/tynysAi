"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngTuple } from "leaflet";
import L from "leaflet";
import { usePathname } from "next/navigation";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import { DeviceDetailModal, type DeviceDetails } from "@/components/device-detail-modal";
import { LanguageSwitcherCompact } from "@/components/language-switcher";
import type { RouteGeometryResponse, RouteStep } from "@/types/route";

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
    routing: string;
    routeUnavailable: string;
    routeDistance: string;
    routeEta: string;
    routeGuidance: string;
    routeNoGuidance: string;
    metersAway: string;
    destination: string;
    enableLocation: string;
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
    routing: "Routing to selected destination...",
    routeUnavailable: "Route unavailable right now",
    routeDistance: "Route distance",
    routeEta: "ETA",
    routeGuidance: "Route guidance",
    routeNoGuidance: "No detailed turn guidance available",
    metersAway: "m",
    destination: "Selected destination",
    enableLocation: "Enable location to view nearest AQI",
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
    routing: "Строим маршрут к выбранной точке...",
    routeUnavailable: "Маршрут сейчас недоступен",
    routeDistance: "Длина маршрута",
    routeEta: "Время",
    routeGuidance: "Подсказки маршрута",
    routeNoGuidance: "Подробные подсказки недоступны",
    metersAway: "м",
    destination: "Выбранная точка",
    enableLocation: "Включите геолокацию для отображения ближайшего AQI",
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
    routing: "Таңдалған нүктеге маршрут құрылуда...",
    routeUnavailable: "Маршрут қазір қолжетімсіз",
    routeDistance: "Маршрут қашықтығы",
    routeEta: "Уақыты",
    routeGuidance: "Маршрут нусқаулары",
    routeNoGuidance: "Толық бұрылыс нусқаулары жок",
    metersAway: "м",
    destination: "Таңдалған нүкте",
    enableLocation: "Жақын AQI көру үшін геолокацияны қосыңыз",
    kmAway: "км",
    userLocation: "Сіздің орныңыз",
  },
};

type GuidanceArrowKind = "straight" | "left" | "right" | "slight-left" | "slight-right" | "uturn-left" | "uturn-right";
const TURN_ARROW_THRESHOLD_METERS = 20;

function normalizeManeuver(value?: string) {
  return value?.toLowerCase().trim() ?? "";
}

function getArrowKind(step?: RouteStep | null): GuidanceArrowKind {
  if (!step) return "straight";
  const type = normalizeManeuver(step.maneuverType);
  const modifier = normalizeManeuver(step.maneuverModifier);

  if (type.includes("uturn") || modifier.includes("uturn")) {
    if (modifier.includes("right")) return "uturn-right";
    return "uturn-left";
  }

  if (modifier.includes("slight right") || modifier.includes("sharp right") || modifier === "right") {
    return modifier.includes("slight") ? "slight-right" : "right";
  }
  if (modifier.includes("slight left") || modifier.includes("sharp left") || modifier === "left") {
    return modifier.includes("slight") ? "slight-left" : "left";
  }

  if (type.includes("turn") || type.includes("fork") || type.includes("merge") || type.includes("ramp")) {
    if (type.includes("right")) return "right";
    if (type.includes("left")) return "left";
  }

  return "straight";
}

function isTurnArrow(kind: GuidanceArrowKind) {
  return kind !== "straight";
}

function GuidanceArrow({ kind, className }: { kind: GuidanceArrowKind; className?: string }) {
  const pathByKind: Record<GuidanceArrowKind, string> = {
    straight: "M12 21V6 M12 6 L7.5 10.5 M12 6 L16.5 10.5",
    right: "M6 21V7 H16 M16 7 L11.5 2.5 M16 7 L11.5 11.5",
    left: "M18 21V7 H8 M8 7 L12.5 2.5 M8 7 L12.5 11.5",
    "slight-right": "M8 20 L16 12 M16 12 V6 M16 12 H10",
    "slight-left": "M16 20 L8 12 M8 12 V6 M8 12 H14",
    "uturn-left": "M16 21V9 A4 4 0 0 0 12 5 H7 M7 5 L11 1.5 M7 5 L11 8.5",
    "uturn-right": "M8 21V9 A4 4 0 0 1 12 5 H17 M17 5 L13 1.5 M17 5 L13 8.5",
  };

  return (
    <svg viewBox="0 0 24 24" className={cn("h-8 w-8 text-slate-100", className)} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={pathByKind[kind]} />
    </svg>
  );
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(from: LatLngTuple, to: LatLngTuple) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(to[0] - from[0]);
  const dLng = toRadians(to[1] - from[1]);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRadians(from[0]))
    * Math.cos(toRadians(to[0]))
    * Math.sin(dLng / 2)
    * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

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

function createUserLocationIcon() {
  return L.divIcon({
    className: "user-location-icon",
    html: `
      <div style="position: relative; width: 28px; height: 28px;">
        <span style="
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          border: 2px solid rgba(59,130,246,0.85);
          background: rgba(59,130,246,0.22);
          animation: userPulse 1.5s ease-out infinite;
        "></span>
        <span style="
          position: absolute;
          left: 50%;
          top: 50%;
          width: 13px;
          height: 13px;
          border-radius: 9999px;
          background: #3b82f6;
          border: 2px solid #ffffff;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 14px rgba(59,130,246,0.95);
        "></span>
      </div>
      <style>
        @keyframes userPulse {
          0% { transform: scale(0.55); opacity: 0.95; }
          70% { transform: scale(1.85); opacity: 0.15; }
          100% { transform: scale(2.05); opacity: 0; }
        }
      </style>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -15],
  });
}

const USER_LOCATION_ICON = createUserLocationIcon();

function FitToMarkers({
  points,
  userLocation,
  useUserLocation,
  routeDestination,
  routeGeometry,
}: {
  points: AggregatedPoint[];
  userLocation: LatLngTuple | null;
  useUserLocation: boolean;
  routeDestination: LatLngTuple | null;
  routeGeometry: LatLngTuple[] | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    if (routeGeometry && routeGeometry.length > 1) {
      const bounds = L.latLngBounds(routeGeometry);
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 15 });
      return;
    }

    const coords = points.map((p) => p.coords);
    if (useUserLocation && userLocation) {
      coords.push(userLocation);
    }
    if (routeDestination) {
      coords.push(routeDestination);
    }

    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.setView(coords[0], 12);
      return;
    }

    const bounds = L.latLngBounds(coords);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: useUserLocation ? 13 : 12 });
  }, [map, points, routeDestination, routeGeometry, userLocation, useUserLocation]);

  return null;
}

export function AirQualityMap({
  readings,
  emptyStateText,
  heightClass = "h-[420px]",
  className,
  showLanguageToggle = false,
  useUserLocation = false,
  recenterRequestId,
  showUserStatus = false,
  showUserStatusAsPopover = false,
  routeDestination = null,
}: {
  readings: MapReading[];
  emptyStateText: string;
  heightClass?: string;
  className?: string;
  showLegend?: boolean;
  showLanguageToggle?: boolean;
  useUserLocation?: boolean;
  recenterRequestId?: number;
  showUserStatus?: boolean;
  showUserStatusAsPopover?: boolean;
  routeDestination?: LatLngTuple | null;
}) {
  const pathname = usePathname();
  const pathnameLocale = (pathname?.split("/")[1] ?? "en") as "en" | "ru" | "kz";
  const locale = pathnameLocale === "ru" || pathnameLocale === "kz" ? pathnameLocale : "en";
  const text = MAP_TEXT[locale];

  const points = useMemo(() => aggregatePoints(readings), [readings]);
  const [userLocation, setUserLocation] = useState<LatLngTuple | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [routeGeometry, setRouteGeometry] = useState<LatLngTuple[] | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [routeSteps, setRouteSteps] = useState<RouteStep[]>([]);
  const [isRouting, setIsRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<DeviceDetails | null>(null);
  const [isDeviceModalOpen, setIsDeviceModalOpen] = useState(false);
  const routeRequestMetaRef = useRef<{
    source: LatLngTuple | null;
    destinationKey: string | null;
    requestAt: number;
  }>({
    source: null,
    destinationKey: null,
    requestAt: 0,
  });
  const latestRouteRequestIdRef = useRef(0);

  const center = useMemo<LatLngTuple>(() => {
    if (points.length === 0) return DEFAULT_CENTER;
    const [latSum, lngSum] = points.reduce(
      (acc, point) => [acc[0] + point.coords[0], acc[1] + point.coords[1]],
      [0, 0],
    );
    return [latSum / points.length, lngSum / points.length];
  }, [points]);

  useEffect(() => {
    if (!useUserLocation) {
      setUserLocation(null);
      setIsLocating(false);
      return;
    }

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setIsLocating(false);
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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  }, [recenterRequestId, useUserLocation]);

  useEffect(() => {
    if (!routeDestination || !useUserLocation || !userLocation) {
      console.info("[RouteDebug] routeEffect:reset", {
        hasRouteDestination: Boolean(routeDestination),
        useUserLocation,
        hasUserLocation: Boolean(userLocation),
      });
      setRouteGeometry(null);
      setRouteDistanceKm(null);
      setRouteSteps([]);
      setIsRouting(false);
      setRouteError(null);
      routeRequestMetaRef.current = {
        source: null,
        destinationKey: null,
        requestAt: 0,
      };
      return;
    }

    const destinationKey = `${routeDestination[0].toFixed(6)},${routeDestination[1].toFixed(6)}`;
    const last = routeRequestMetaRef.current;
    const elapsedMs = Date.now() - last.requestAt;
    const movedKm = last.source ? haversineDistanceKm(last.source, userLocation) : Number.POSITIVE_INFINITY;
    const destinationChanged = destinationKey !== last.destinationKey;
    const shouldFetch = destinationChanged || last.requestAt === 0 || (movedKm >= 0.04 && elapsedMs >= 7000);

    console.info("[RouteDebug] routeEffect:evaluate", {
      destinationKey,
      destinationChanged,
      elapsedMs,
      movedKm,
      shouldFetch,
    });

    if (!shouldFetch) {
      return;
    }

    const requestId = latestRouteRequestIdRef.current + 1;
    latestRouteRequestIdRef.current = requestId;

    routeRequestMetaRef.current = {
      source: userLocation,
      destinationKey,
      requestAt: Date.now(),
    };

    setIsRouting(true);
    setRouteError(null);

    console.info("[RouteDebug] routeFetch:start", {
      source: { lat: userLocation[0], lng: userLocation[1] },
      destination: { lat: routeDestination[0], lng: routeDestination[1] },
    });

    void fetch("/api/v1/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        source: {
          latitude: userLocation[0],
          longitude: userLocation[1],
        },
        destination: {
          latitude: routeDestination[0],
          longitude: routeDestination[1],
        },
      }),
    })
      .then(async (response) => {
        if (requestId !== latestRouteRequestIdRef.current) {
          return;
        }
        console.info("[RouteDebug] routeFetch:status", { status: response.status });
        if (!response.ok) {
          const errorPayload = (await response.json().catch(() => null)) as { error?: string } | null;
          console.error("[RouteDebug] routeFetch:api-error", { error: errorPayload?.error ?? "unknown" });
          throw new Error(errorPayload?.error || "route-fetch-failed");
        }
        const payload = (await response.json()) as RouteGeometryResponse;

        console.info("[RouteDebug] routeFetch:payload", {
          geometryPoints: payload.geometry?.length ?? 0,
          distanceMeters: payload.distanceMeters,
        });

        if (!payload.geometry || payload.geometry.length < 2) {
          throw new Error("invalid-route-geometry");
        }

        setRouteGeometry(payload.geometry.map((coords) => [coords[0], coords[1]]));
        setRouteDistanceKm(payload.distanceMeters / 1000);
        setRouteSteps(payload.steps ?? []);
        setRouteError(null);
        console.info("[RouteDebug] routeFetch:draw-success");
      })
      .catch((error: unknown) => {
        if (requestId !== latestRouteRequestIdRef.current) {
          return;
        }
        // Fallback: still draw a direct line so the user can navigate visually when routing provider fails.
        setRouteGeometry([userLocation, routeDestination]);
        setRouteDistanceKm(haversineDistanceKm(userLocation, routeDestination));
        setRouteSteps([]);
        setRouteError(text.routeUnavailable);
        console.error("[RouteDebug] routeFetch:failed-using-fallback", {
          message: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        if (requestId !== latestRouteRequestIdRef.current) {
          return;
        }
        setIsRouting(false);
        console.info("[RouteDebug] routeFetch:finished");
      });
  }, [routeDestination, text.routeUnavailable, useUserLocation, userLocation]);

  useEffect(() => {
    if (!routeGeometry) return;
    console.info("[RouteDebug] routeGeometry:update", {
      points: routeGeometry.length,
      first: routeGeometry[0],
      last: routeGeometry[routeGeometry.length - 1],
    });
  }, [routeGeometry]);

  const nearestAqi = useMemo(() => {
    if (!useUserLocation) return null;
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
  }, [useUserLocation, userLocation, points, text]);

  const statusValueText = !useUserLocation
    ? text.enableLocation
    : isLocating
      ? text.locating
      : routeDestination && routeError
        ? routeError
        : routeDestination && isRouting
          ? text.routing
      : nearestAqi
        ? `${Math.round(nearestAqi.value)} · ${nearestAqi.label} · ${nearestAqi.distanceKm.toFixed(1)} ${text.kmAway}`
        : "-";

  const nextRouteStep = useMemo(() => {
    if (routeSteps.length === 0) return null;
    return routeSteps.find((step) => step.distanceMeters > 0 && normalizeManeuver(step.maneuverType) !== "arrive") ?? routeSteps[0];
  }, [routeSteps]);

  const nextStepDistanceMeters = useMemo(() => {
    if (nextRouteStep && Number.isFinite(nextRouteStep.distanceMeters)) {
      return Math.max(0, nextRouteStep.distanceMeters);
    }
    if (routeDistanceKm !== null && Number.isFinite(routeDistanceKm)) {
      return Math.max(0, routeDistanceKm * 1000);
    }
    return null;
  }, [nextRouteStep, routeDistanceKm]);

  const nextArrowKind = useMemo(() => getArrowKind(nextRouteStep), [nextRouteStep]);
  const showTurnArrow = Boolean(nextStepDistanceMeters !== null && nextStepDistanceMeters <= TURN_ARROW_THRESHOLD_METERS && isTurnArrow(nextArrowKind));
  const activeGuidanceArrow: GuidanceArrowKind = showTurnArrow ? nextArrowKind : "straight";
  const stepDistanceLabel = `${Math.max(0, Math.round(nextStepDistanceMeters ?? 0))} ${text.metersAway}`;
  const showNearbyStatusCard = showUserStatus && !showUserStatusAsPopover;
  const stackTopClass = showLanguageToggle
    ? "top-20"
    : showUserStatusAsPopover
      ? "top-[calc(env(safe-area-inset-top)+3.5rem)]"
      : "top-3";

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
        {showLanguageToggle ? (
          <div className="absolute right-3 top-3 z-[500]">
            <LanguageSwitcherCompact minimal />
          </div>
        ) : null}

        {(showNearbyStatusCard || (routeDestination && routeGeometry && routeGeometry.length > 1)) ? (
          <div className={cn("absolute right-3 z-[500] flex flex-col items-end gap-2", stackTopClass)}>
            {showNearbyStatusCard ? (
              <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 shadow-lg">
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{text.nearbyAqi}</p>
                <p
                  className={cn("mt-1", useUserLocation && nearestAqi ? "font-semibold" : "text-slate-300")}
                  style={useUserLocation && nearestAqi ? { color: nearestAqi.color } : undefined}
                >
                  {statusValueText}
                </p>
              </div>
            ) : null}

            {routeDestination && routeGeometry && routeGeometry.length > 1 ? (
              <div className="pointer-events-none flex flex-col items-center rounded-xl border border-slate-700/90 bg-slate-950/95 px-2 py-2 shadow-xl backdrop-blur">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-600 bg-slate-900">
                  <GuidanceArrow kind={activeGuidanceArrow} className="h-5 w-5" />
                </div>
                <p className="mt-1 text-[11px] font-semibold tabular-nums text-slate-100">{stepDistanceLabel}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="relative flex-1 overflow-hidden rounded-lg">
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
            className="h-full w-full bg-slate-950"
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitToMarkers
              points={points}
              userLocation={userLocation}
              useUserLocation={useUserLocation}
              routeDestination={routeDestination}
              routeGeometry={routeGeometry}
            />

            {routeGeometry && routeGeometry.length > 1 ? (
              <Polyline
                positions={routeGeometry}
                pathOptions={{ color: "#2563eb", weight: 7, opacity: 0.95 }}
              />
            ) : null}

            {routeDestination ? (
              <CircleMarker
                center={routeDestination}
                radius={7}
                pathOptions={{ color: "#2563eb", fillColor: "#2563eb", fillOpacity: 0.95, weight: 2 }}
              >
                <Popup>{text.destination}</Popup>
              </CircleMarker>
            ) : null}

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

            {useUserLocation && userLocation ? (
              <>
                <Marker position={userLocation} icon={USER_LOCATION_ICON}>
                  <Popup>{text.userLocation}</Popup>
                </Marker>
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
