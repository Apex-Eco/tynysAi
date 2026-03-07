"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { DashboardMapPanel } from "./map-panel-client";
import { NearbyDevicesPanel } from "@/components/nearby-devices-panel";
import { LanguageSwitcherCompact } from "@/components/language-switcher";
import { CompactActivityFeed } from "@/components/compact-activity-feed";
import { SensorChart } from "@/components/sensor-chart";
import { SensorDistribution, type SensorSlice } from "@/components/sensor-distribution";
import { fetchNearbyDevices, type NearbyDevice } from "@/lib/device-api";
import { exportSensorReportPdf } from "@/lib/utils/export-pdf";
import type { GoodAirOption, NearestGoodAirResponse } from "@/types/route";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  Activity,
  Database,
  Download,
  Filter,
  LineChart,
  Navigation,
  Microscope,
  Radio,
  Search,
  TrendingUp,
  House,
  Route,
  type LucideIcon,
} from "lucide-react";
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

export type SensorReading = {
  id?: number | string;
  timestamp: string;
  sensorId: string;
  value: number;
  location: string | null;
  transportType: string | null;
  ingestedAt?: Date | string;
};

interface DashboardCopy {
  totalDataPoints: string;
  activeSensors: string;
  recentReadings: string;
  averageValue: string;
  noGeocodedData: string;
  recentIotData: string;
  noRecentActivity: string;
  geoDescription?: string;
  sensorStatistics: string;
  keyMetrics: string;
  noSensorStats: string;
  sensorDataDistribution: string;
  recentReadingsBySensor: string;
  noSensorData: string;
  minimumValue: string;
  maximumValue: string;
}

interface DashboardClientProps {
  readings: SensorReading[];
  dict: DashboardCopy;
}

type StatValues = {
  totalDataPoints: number;
  activeSensors: number;
  recentReadings: number;
  avgSensorValue: string;
};

type SectionHeaderProps = {
  id?: string;
  icon: LucideIcon;
  title: string;
  className?: string;
};

type DashboardLocale = "en" | "ru" | "kz";
type SidebarAction = "search" | "home" | "location" | "route" | "trends";

const MOBILE_LOCATION_PREF_KEY = "dashboard.mobile.location.enabled";
const DESKTOP_LOCATION_PREF_KEY = "dashboard.desktop.location.enabled";

const DASHBOARD_UI_TEXT: Record<
  DashboardLocale,
  {
    filters: string;
    sensorId: string;
    allSensors: string;
    location: string;
    allLocations: string;
    noLocationsAvailable: string;
    transportType: string;
    allTypes: string;
    noTransportTypesAvailable: string;
    startDate: string;
    endDate: string;
    reset: string;
    activePoints: string;
    airComposition: string;
    historicalTrends: string;
    openTrends: string;
    exportPdf: string;
    exporting: string;
    language: string;
    controlPanel: string;
    account: string;
    noEmail: string;
    role: string;
    admin: string;
    operator: string;
    signOut: string;
    justNow: string;
    airCompositionAnalysis: string;
    average: string;
    search: string;
    home: string;
    locate: string;
    locating: string;
    route: string;
    close: string;
    routeComingSoon: string;
    routeLoading: string;
    routeNoOptions: string;
    routeLoadError: string;
    routeRetry: string;
    routeChooseGo: string;
    routeDistance: string;
    routeAqi: string;
  }
> = {
  en: {
    filters: "Filters",
    sensorId: "Sensor ID",
    allSensors: "All Sensors",
    location: "Location",
    allLocations: "All Locations",
    noLocationsAvailable: "No locations available",
    transportType: "Transport Type",
    allTypes: "All Types",
    noTransportTypesAvailable: "No transport types available",
    startDate: "Start Date",
    endDate: "End Date",
    reset: "Reset",
    activePoints: "active points",
    airComposition: "Air Composition",
    historicalTrends: "Historical Trends",
    openTrends: "Open Trends",
    exportPdf: "Export PDF",
    exporting: "Exporting...",
    language: "Language",
    controlPanel: "Control Panel",
    account: "Account",
    noEmail: "No email",
    role: "Role",
    admin: "Admin",
    operator: "Operator",
    signOut: "Sign Out",
    justNow: "just now",
    airCompositionAnalysis: "Air Composition Analysis",
    average: "Average",
    search: "Search",
    home: "Home",
    locate: "Location",
    locating: "Locating...",
    route: "Route",
    close: "Close",
    routeComingSoon: "Route to nearest clean-air zone is coming next.",
    routeLoading: "Loading nearby clean-air options...",
    routeNoOptions: "No nearby clean-air options found right now.",
    routeLoadError: "Could not load route options. Please try again.",
    routeRetry: "Retry",
    routeChooseGo: "Choose & Go",
    routeDistance: "Distance",
    routeAqi: "AQI",
  },
  ru: {
    filters: "Фильтры",
    sensorId: "ID сенсора",
    allSensors: "Все сенсоры",
    location: "Локация",
    allLocations: "Все локации",
    noLocationsAvailable: "Локации недоступны",
    transportType: "Тип транспорта",
    allTypes: "Все типы",
    noTransportTypesAvailable: "Типы транспорта недоступны",
    startDate: "Начальная дата",
    endDate: "Конечная дата",
    reset: "Сброс",
    activePoints: "активных точек",
    airComposition: "Состав воздуха",
    historicalTrends: "Исторические тренды",
    openTrends: "Открыть тренды",
    exportPdf: "Экспорт PDF",
    exporting: "Экспорт...",
    language: "Язык",
    controlPanel: "Панель управления",
    account: "Аккаунт",
    noEmail: "Нет email",
    role: "Роль",
    admin: "Админ",
    operator: "Оператор",
    signOut: "Выйти",
    justNow: "сейчас",
    airCompositionAnalysis: "Анализ состава воздуха",
    average: "Среднее",
    search: "Поиск",
    home: "Главная",
    locate: "Локация",
    locating: "Определяем...",
    route: "Маршрут",
    close: "Закрыть",
    routeComingSoon: "Маршрут до ближайшей зоны с чистым воздухом будет добавлен следующим шагом.",
    routeLoading: "Загружаем ближайшие точки с чистым воздухом...",
    routeNoOptions: "Сейчас рядом нет точек с хорошим AQI.",
    routeLoadError: "Не удалось загрузить варианты маршрута. Повторите попытку.",
    routeRetry: "Повторить",
    routeChooseGo: "Выбрать и ехать",
    routeDistance: "Расстояние",
    routeAqi: "AQI",
  },
  kz: {
    filters: "Сүзгілер",
    sensorId: "Сенсор ID",
    allSensors: "Барлық сенсорлар",
    location: "Орналасу",
    allLocations: "Барлық орындар",
    noLocationsAvailable: "Орындар қолжетімсіз",
    transportType: "Көлік түрі",
    allTypes: "Барлық түрлер",
    noTransportTypesAvailable: "Көлік түрлері қолжетімсіз",
    startDate: "Басталу күні",
    endDate: "Аяқталу күні",
    reset: "Тазарту",
    activePoints: "белсенді нүкте",
    airComposition: "Ауа құрамы",
    historicalTrends: "Тарихи трендтер",
    openTrends: "Трендтерді ашу",
    exportPdf: "PDF экспорт",
    exporting: "Экспорт...",
    language: "Тіл",
    controlPanel: "Басқару панелі",
    account: "Тіркелгі",
    noEmail: "Email жоқ",
    role: "Рөл",
    admin: "Әкімші",
    operator: "Оператор",
    signOut: "Шығу",
    justNow: "қазір",
    airCompositionAnalysis: "Ауа құрамын талдау",
    average: "Орташа",
    search: "Іздеу",
    home: "Басты",
    locate: "Орналасу",
    locating: "Анықталуда...",
    route: "Бағыт",
    close: "Жабу",
    routeComingSoon: "Ең жақын таза ауа аймағына бағыттау келесі қадамда қосылады.",
    routeLoading: "Жақын таза ауа нүктелері жүктелуде...",
    routeNoOptions: "Қазір жақын маңда таза ауа нүктелері табылмады.",
    routeLoadError: "Бағыт нұсқаларын жүктеу мүмкін болмады. Қайталап көріңіз.",
    routeRetry: "Қайталау",
    routeChooseGo: "Таңдап бару",
    routeDistance: "Қашықтық",
    routeAqi: "AQI",
  },
};

const NEARBY_DEVICES_TEXT: Record<
  DashboardLocale,
  {
    title: string;
    locating: string;
    empty: string;
    error: string;
    kmAway: string;
    online: string;
    idle: string;
    offline: string;
  }
> = {
  en: {
    title: "Nearby Devices",
    locating: "Detecting your location and loading devices...",
    empty: "No nearby devices found.",
    error: "Location unavailable or failed to load nearby devices.",
    kmAway: "km away",
    online: "Online",
    idle: "Idle",
    offline: "Offline",
  },
  ru: {
    title: "Ближайшие устройства",
    locating: "Определяем вашу геолокацию и загружаем устройства...",
    empty: "Рядом устройства не найдены.",
    error: "Геолокация недоступна или не удалось загрузить ближайшие устройства.",
    kmAway: "км",
    online: "Онлайн",
    idle: "Ожидание",
    offline: "Офлайн",
  },
  kz: {
    title: "Жақын құрылғылар",
    locating: "Орналасқан жеріңіз анықталып, құрылғылар жүктелуде...",
    empty: "Жақын маңда құрылғылар табылмады.",
    error: "Геолокация қолжетімсіз немесе жақын құрылғыларды жүктеу мүмкін болмады.",
    kmAway: "км",
    online: "Онлайн",
    idle: "Күту",
    offline: "Офлайн",
  },
};

function SectionHeader({ id, icon: Icon, title, className }: SectionHeaderProps) {
  return (
    <div
      id={id}
      className={cn(
        "text-lg font-mono font-semibold tracking-tight text-foreground flex items-center gap-2 mb-4 mt-8 border-b pb-2",
        "scroll-mt-28",
        className
      )}
    >
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span>{title}</span>
    </div>
  );
}

export function DashboardClient({ readings, dict }: DashboardClientProps) {
  const pathname = usePathname();
  const [selectedSensor, setSelectedSensor] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [selectedTransportType, setSelectedTransportType] = useState<string>("all");
  const [sensorSearchQuery, setSensorSearchQuery] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isAnalyticsDialogOpen, setIsAnalyticsDialogOpen] = useState(false);
  const [isMobileAccountOpen, setIsMobileAccountOpen] = useState(false);
  const [isMobileSearchDialogOpen, setIsMobileSearchDialogOpen] = useState(false);
  const [isRouteDialogOpen, setIsRouteDialogOpen] = useState(false);
  const [routeOptions, setRouteOptions] = useState<GoodAirOption[]>([]);
  const [isRouteOptionsLoading, setIsRouteOptionsLoading] = useState(false);
  const [routeOptionsError, setRouteOptionsError] = useState<string | null>(null);
  const [activeRouteDestination, setActiveRouteDestination] = useState<[number, number] | null>(null);
  const [activeRouteOptionId, setActiveRouteOptionId] = useState<string | null>(null);
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [mobileMapKey, setMobileMapKey] = useState(0);
  const [isMobileLocationActive, setIsMobileLocationActive] = useState(false);
  const [isMobileLocationPending, setIsMobileLocationPending] = useState(false);
  const [desktopMapKey, setDesktopMapKey] = useState(0);
  const [isDesktopLocationActive, setIsDesktopLocationActive] = useState(false);
  const [desktopRecenterRequestId, setDesktopRecenterRequestId] = useState(0);
  const [mobileRecenterRequestId, setMobileRecenterRequestId] = useState(0);
  const [isLocationPrefHydrated, setIsLocationPrefHydrated] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState<NearbyDevice[]>([]);
  const [isNearbyLoading, setIsNearbyLoading] = useState(false);
  const [hasNearbyError, setHasNearbyError] = useState(false);
  const { data: session } = useSession();
  const locale: DashboardLocale = pathname?.startsWith("/ru")
    ? "ru"
    : pathname?.startsWith("/kz")
      ? "kz"
      : "en";
  const ui = DASHBOARD_UI_TEXT[locale];
  const nearbyText = NEARBY_DEVICES_TEXT[locale];

  const filterOptions = useMemo(() => {
    const sensors = new Set(readings.map((reading) => reading.sensorId));
    const locations = new Set(
      readings
        .filter((reading) => reading.location)
        .map((reading) => reading.location as string)
    );
    const transportTypes = new Set(
      readings
        .filter((reading) => reading.transportType)
        .map((reading) => reading.transportType as string)
    );

    return {
      sensors: Array.from(sensors).sort(),
      locations: Array.from(locations).sort(),
      transportTypes: Array.from(transportTypes).sort(),
    };
  }, [readings]);

  const filteredReadings = useMemo(() => {
    let filtered = [...readings];

    if (sensorSearchQuery.trim()) {
      const query = sensorSearchQuery.trim().toLowerCase();
      filtered = filtered.filter((reading) => reading.sensorId.toLowerCase().includes(query));
    }

    if (selectedSensor !== "all") {
      filtered = filtered.filter((reading) => reading.sensorId === selectedSensor);
    }

    if (selectedLocation !== "all") {
      filtered = filtered.filter((reading) => reading.location === selectedLocation);
    }

    if (selectedTransportType !== "all") {
      filtered = filtered.filter((reading) => reading.transportType === selectedTransportType);
    }

    if (startDate) {
      const start = new Date(startDate).getTime();
      filtered = filtered.filter((reading) => new Date(reading.timestamp).getTime() >= start);
    }

    if (endDate) {
      const end = new Date(endDate).getTime() + 86400000;
      filtered = filtered.filter((reading) => new Date(reading.timestamp).getTime() <= end);
    }

    return filtered.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [
    readings,
    sensorSearchQuery,
    selectedSensor,
    selectedLocation,
    selectedTransportType,
    startDate,
    endDate,
  ]);

  const statValues: StatValues = useMemo(() => {
    const uniqueSensors = new Set(filteredReadings.map((r) => r.sensorId));
    const avgSensorValue = filteredReadings.length
      ? (
          filteredReadings.reduce((sum, r) => sum + r.value, 0) /
          filteredReadings.length
        ).toFixed(2)
      : "0.00";

    return {
      totalDataPoints: filteredReadings.length,
      activeSensors: uniqueSensors.size,
      recentReadings: filteredReadings.length,
      avgSensorValue,
    };
  }, [filteredReadings]);

  const statItems = useMemo(
    () => [
      { label: dict.totalDataPoints, value: statValues.totalDataPoints, icon: Database },
      { label: dict.activeSensors, value: statValues.activeSensors, icon: Radio },
      { label: dict.averageValue, value: statValues.avgSensorValue, icon: TrendingUp },
    ],
    [dict, statValues]
  );

  const sensorSlices: SensorSlice[] = useMemo(() => {
    const counts = filteredReadings.reduce((acc, reading) => {
      acc[reading.sensorId] = (acc[reading.sensorId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6)
      .map(([sensorId, count]) => ({
        sensorId,
        count,
        percentage: Math.round((count / Math.max(filteredReadings.length, 1)) * 100),
      }));
  }, [filteredReadings]);

  const activityFeed = useMemo(() => {
    return filteredReadings.slice(0, 10).map((reading) => ({
      id: reading.id ?? `${reading.sensorId}-${String(reading.ingestedAt ?? reading.timestamp)}`,
      sensorId: reading.sensorId,
      timestamp: reading.ingestedAt ?? reading.timestamp,
    }));
  }, [filteredReadings]);

  const getUserInitials = (name?: string | null) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleSignOut = () => {
    let callbackUrl = "/";
    if (typeof window !== "undefined") {
      const locale = window.location.pathname.split("/")[1];
      callbackUrl = locale ? `/${locale}` : "/";
    }
    signOut({ callbackUrl });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const mobilePref = window.localStorage.getItem(MOBILE_LOCATION_PREF_KEY) === "1";
      const desktopPref = window.localStorage.getItem(DESKTOP_LOCATION_PREF_KEY) === "1";

      if (mobilePref) {
        setIsMobileLocationActive(true);
        setMobileRecenterRequestId((current) => current + 1);
      }

      if (desktopPref) {
        setIsDesktopLocationActive(true);
        setDesktopRecenterRequestId((current) => current + 1);
      }
    } catch {
      // Ignore storage access issues (private mode / restricted environments)
    } finally {
      setIsLocationPrefHydrated(true);
    }

    const media = window.matchMedia("(max-width: 1023px)");

    const apply = () => {
      setIsMobileDevice(media.matches);
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !isLocationPrefHydrated) return;

    try {
      window.localStorage.setItem(MOBILE_LOCATION_PREF_KEY, isMobileLocationActive ? "1" : "0");
    } catch {
      // Ignore storage write failures
    }
  }, [isLocationPrefHydrated, isMobileLocationActive]);

  useEffect(() => {
    if (typeof window === "undefined" || !isLocationPrefHydrated) return;

    try {
      window.localStorage.setItem(DESKTOP_LOCATION_PREF_KEY, isDesktopLocationActive ? "1" : "0");
    } catch {
      // Ignore storage write failures
    }
  }, [isDesktopLocationActive, isLocationPrefHydrated]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (isMobileDevice) {
      setNearbyDevices([]);
      setIsNearbyLoading(false);
      setHasNearbyError(false);
      return;
    }

    if (!("geolocation" in navigator)) {
      setHasNearbyError(true);
      return;
    }

    let isActive = true;
    setIsNearbyLoading(true);
    setHasNearbyError(false);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (!isActive) return;

        try {
          const devices = await fetchNearbyDevices(
            {
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            },
            6,
          );
          if (!isActive) return;
          setNearbyDevices(devices);
          setHasNearbyError(false);
        } catch (error) {
          if (!isActive) return;
          console.error("Failed to load nearby devices:", error);
          setHasNearbyError(true);
          setNearbyDevices([]);
        } finally {
          if (isActive) {
            setIsNearbyLoading(false);
          }
        }
      },
      () => {
        if (!isActive) return;
        setHasNearbyError(true);
        setNearbyDevices([]);
        setIsNearbyLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );

    return () => {
      isActive = false;
    };
  }, [isMobileDevice]);

  const handleMobileSearchOpen = () => {
    setIsMobileSearchDialogOpen(true);
  };

  const handleMobileHome = () => {
    setMobileMapKey((current) => current + 1);
    setIsMobileLocationActive(false);
    setIsMobileLocationPending(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleMobileLocationToggle = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setIsMobileLocationActive(false);
      setIsMobileLocationPending(false);
      return;
    }

    setIsMobileLocationPending(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setIsMobileLocationActive(true);
        setMobileRecenterRequestId((current) => current + 1);
        setIsMobileLocationPending(false);
      },
      () => {
        setIsMobileLocationPending(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
    );
  };

  const loadRouteOptions = useCallback(() => {
    console.info("[RouteDebug] loadRouteOptions:start", { isMobileDevice });

    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      console.error("[RouteDebug] loadRouteOptions:no-geolocation");
      setRouteOptions([]);
      setRouteOptionsError(ui.routeLoadError);
      setIsRouteOptionsLoading(false);
      return;
    }

    setIsRouteOptionsLoading(true);
    setRouteOptionsError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        console.info("[RouteDebug] loadRouteOptions:position", { lat, lng });

        try {
          const response = await fetch(`/api/v1/nearest-good-air?lat=${lat}&lng=${lng}`, {
            method: "GET",
            cache: "no-store",
          });

          console.info("[RouteDebug] loadRouteOptions:api-status", { status: response.status });

          if (!response.ok) {
            throw new Error("route-options-failed");
          }

          const payload = (await response.json()) as NearestGoodAirResponse;
          const options = payload.options ?? [];

          console.info("[RouteDebug] loadRouteOptions:success", {
            count: options.length,
            first: options[0]
              ? {
                  id: options[0].id,
                  label: options[0].label,
                  distanceKm: options[0].distanceKm,
                }
              : null,
          });

          setRouteOptions(options);
          setRouteOptionsError(options.length > 0 ? null : (payload.message ?? ui.routeNoOptions));
        } catch (error) {
          console.error("Failed to load clean-air route options:", error);
          console.error("[RouteDebug] loadRouteOptions:failed", {
            message: error instanceof Error ? error.message : String(error),
          });
          setRouteOptions([]);
          setRouteOptionsError(ui.routeLoadError);
        } finally {
          setIsRouteOptionsLoading(false);
        }
      },
      (geoError) => {
        console.error("[RouteDebug] loadRouteOptions:geo-error", {
          code: geoError.code,
          message: geoError.message,
        });
        setRouteOptions([]);
        setRouteOptionsError(ui.routeLoadError);
        setIsRouteOptionsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 },
    );
  }, [isMobileDevice, ui.routeLoadError, ui.routeNoOptions]);

  const handleRouteAction = useCallback(() => {
    console.info("[RouteDebug] handleRouteAction:open-dialog");
    setIsRouteDialogOpen(true);
    loadRouteOptions();
  }, [loadRouteOptions]);

  const handleChooseRouteDestination = useCallback((option: GoodAirOption) => {
    console.info("[RouteDebug] chooseDestination", {
      id: option.id,
      label: option.label,
      latitude: option.latitude,
      longitude: option.longitude,
      distanceKm: option.distanceKm,
      isMobileDevice,
    });
    setActiveRouteDestination([option.latitude, option.longitude]);
    setActiveRouteOptionId(option.id);

    if (isMobileDevice) {
      setIsMobileLocationActive(true);
      setIsMobileLocationPending(false);
      setMobileRecenterRequestId((current) => current + 1);
    } else {
      setIsDesktopLocationActive(true);
      setDesktopRecenterRequestId((current) => current + 1);
    }

    setIsRouteDialogOpen(false);
  }, [isMobileDevice]);

  const handleDesktopHome = useCallback(() => {
    setDesktopMapKey((current) => current + 1);
    setIsDesktopLocationActive(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleDesktopRecenter = useCallback(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setIsDesktopLocationActive(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        setIsDesktopLocationActive(true);
        setDesktopRecenterRequestId((current) => current + 1);
      },
      () => {
        setIsDesktopLocationActive(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
    );
  }, []);

  const handleDesktopExportReport = useCallback(async () => {
    if (!filteredReadings.length || isExportingReport) return;

    setIsExportingReport(true);

    try {
      await exportSensorReportPdf(
        filteredReadings.map((reading) => ({
          timestamp: reading.timestamp,
          value: reading.value,
          sensorId: reading.sensorId,
          location: reading.location,
        })),
        {
          projectName: "TynysAi",
          dateRange: {
            start: startDate ? new Date(startDate) : null,
            end: endDate ? new Date(endDate) : null,
          },
        },
      );
    } catch (error) {
      console.error("Failed to export report:", error);
    } finally {
      setIsExportingReport(false);
    }
  }, [endDate, filteredReadings, isExportingReport, startDate]);

  useEffect(() => {
    const onAction = (event: Event) => {
      const customEvent = event as CustomEvent<{ action?: SidebarAction }>;
      const action = customEvent.detail?.action;
      if (!action) return;

      if (action === "home") {
        handleDesktopHome();
        return;
      }
      if (action === "location") {
        handleDesktopRecenter();
        return;
      }
      if (action === "route") {
        handleRouteAction();
        return;
      }
      if (action === "trends") {
        setIsAnalyticsDialogOpen(true);
      }
    };

    const onSearch = (event: Event) => {
      const customEvent = event as CustomEvent<{ query?: string }>;
      setSensorSearchQuery(customEvent.detail?.query ?? "");
    };

    window.addEventListener("dashboard:action", onAction as EventListener);
    window.addEventListener("dashboard:search", onSearch as EventListener);

    return () => {
      window.removeEventListener("dashboard:action", onAction as EventListener);
      window.removeEventListener("dashboard:search", onSearch as EventListener);
    };
  }, [handleDesktopHome, handleDesktopRecenter, handleRouteAction]);

  const statNumbers = useMemo(() => {
    const values = filteredReadings.map((r) => r.value);
    const minValue = values.length ? Math.min(...values) : 0;
    const maxValue = values.length ? Math.max(...values) : 0;
    const avgValue = values.length
      ? values.reduce((sum, val) => sum + val, 0) / values.length
      : 0;
    const range = Math.max(maxValue - minValue, 1);
    const gaugePercent = Math.min(100, Math.max(0, ((avgValue - minValue) / range) * 100));

    return { minValue, maxValue, avgValue, gaugePercent };
  }, [filteredReadings]);

  const leadingStatItems = statItems.slice(0, 1);
  const trailingStatItems = statItems.slice(1);

  const renderFilterPopover = (
    open: boolean,
    onOpenChange: (open: boolean) => void
  ) => (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="border-cyan-400/35 bg-slate-900/80 text-slate-100 shadow-md hover:bg-slate-800"
        >
          <Filter className="h-4 w-4 mr-2" />
          {ui.filters}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="z-50 w-80 border-cyan-400/25 bg-slate-950/95 text-slate-100">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">{ui.sensorId}</label>
              <Select value={selectedSensor} onValueChange={setSelectedSensor}>
                <SelectTrigger>
                  <SelectValue placeholder={ui.allSensors} />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="all">{ui.allSensors}</SelectItem>
                  {filterOptions.sensors.map((sensor) => (
                    <SelectItem key={sensor} value={sensor}>
                      {sensor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{ui.location}</label>
              <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                <SelectTrigger>
                  <SelectValue placeholder={ui.allLocations} />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="all">{ui.allLocations}</SelectItem>
                  {filterOptions.locations.length === 0 ? (
                    <SelectItem value="none" disabled>
                      {ui.noLocationsAvailable}
                    </SelectItem>
                  ) : (
                    filterOptions.locations.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{ui.transportType}</label>
              <Select value={selectedTransportType} onValueChange={setSelectedTransportType}>
                <SelectTrigger>
                  <SelectValue placeholder={ui.allTypes} />
                </SelectTrigger>
                <SelectContent className="z-50">
                  <SelectItem value="all">{ui.allTypes}</SelectItem>
                  {filterOptions.transportTypes.length === 0 ? (
                    <SelectItem value="none" disabled>
                      {ui.noTransportTypesAvailable}
                    </SelectItem>
                  ) : (
                    filterOptions.transportTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">{ui.startDate}</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{ui.endDate}</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedSensor("all");
                setSelectedLocation("all");
                setSelectedTransportType("all");
                setStartDate("");
                setEndDate("");
              }}
            >
              {ui.reset}
            </Button>
            <Badge variant="outline" className="uppercase tracking-wide text-[11px]">
              <span className="font-mono mr-1">{filteredReadings.length}</span> {ui.activePoints}
            </Badge>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  const overlayPanelClass =
    "rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl";

  const scrollToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) return;

    const offset = 96;
    const y = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  const analyticsContent = (
    <div className="space-y-6">
      <div className="w-full">
        <SensorChart data={filteredReadings} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>{dict.sensorStatistics}</CardTitle>
          </CardHeader>
          <CardContent>
            {filteredReadings.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {dict.noSensorStats}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 sm:items-center">
                <div className="relative h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="70%"
                      outerRadius="100%"
                      barSize={18}
                      data={[
                        {
                          name: ui.average,
                          value: statNumbers.gaugePercent,
                          fill: "hsl(var(--primary))",
                        },
                      ]}
                      startAngle={225}
                      endAngle={-45}
                    >
                      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                      <RadialBar dataKey="value" cornerRadius={10} background />
                    </RadialBarChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {dict.averageValue}
                    </p>
                    <p className="font-mono text-3xl font-semibold">
                      {statNumbers.avgValue.toFixed(2)}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                    <span className="text-sm text-muted-foreground">{dict.minimumValue}</span>
                    <span className="font-mono font-semibold">{statNumbers.minValue.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                    <span className="text-sm text-muted-foreground">{dict.averageValue}</span>
                    <span className="font-mono font-semibold">{statNumbers.avgValue.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
                    <span className="text-sm text-muted-foreground">{dict.maximumValue}</span>
                    <span className="font-mono font-semibold">{statNumbers.maxValue.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle>{dict.sensorDataDistribution}</CardTitle>
          </CardHeader>
          <CardContent>
            <SensorDistribution
              data={sensorSlices}
              total={filteredReadings.length}
              emptyText={dict.noSensorData}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const routeDialogBody = (
    <div className="space-y-3">
      {isRouteOptionsLoading ? (
        <p className="text-sm text-slate-300">{ui.routeLoading}</p>
      ) : null}

      {!isRouteOptionsLoading && routeOptions.length === 0 && routeOptionsError ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-300">{routeOptionsError}</p>
          <Button variant="outline" onClick={loadRouteOptions}>
            {ui.routeRetry}
          </Button>
        </div>
      ) : null}

      {!isRouteOptionsLoading && routeOptions.length === 0 && !routeOptionsError ? (
        <p className="text-sm text-slate-300">{ui.routeNoOptions}</p>
      ) : null}

      {!isRouteOptionsLoading && routeOptions.length > 0 ? (
        <div className="max-h-[52dvh] space-y-2 overflow-y-auto pr-1">
          {routeOptions.map((option) => {
            const isActive = activeRouteOptionId === option.id;
            return (
              <div
                key={option.id}
                className={cn(
                  "rounded-xl border border-slate-700 bg-slate-900 p-3",
                  isActive ? "border-blue-500/70" : undefined,
                )}
              >
                <p className="truncate text-sm font-semibold text-slate-100">{option.label}</p>
                <p className="mt-1 text-xs text-slate-300">
                  {ui.routeDistance}: {option.distanceKm.toFixed(2)} {nearbyText.kmAway}
                </p>
                <p className="text-xs text-slate-300">
                  {ui.routeAqi}: {Math.round(option.aqi)}
                </p>
                <Button className="mt-3 h-8 w-full" onClick={() => handleChooseRouteDestination(option)}>
                  {ui.routeChooseGo}
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}

      <Button variant="ghost" onClick={() => setIsRouteDialogOpen(false)}>
        {ui.close}
      </Button>
    </div>
  );

  if (isMobileDevice) {
    return (
      <div className="relative isolate min-h-[100dvh] overflow-hidden bg-slate-950 text-slate-100">
        <DashboardMapPanel
          key={`mobile-map-${mobileMapKey}`}
          readings={filteredReadings}
          emptyMapText={dict.noGeocodedData}
          recentActivity={activityFeed}
          feedTitle={dict.recentIotData}
          feedEmptyText={dict.noRecentActivity}
          mapHeightClass="h-[100dvh]"
          backgroundMode={false}
          showFeedOverlay={false}
          mobileMode
          minimalMode
          showLegend={false}
          useUserLocation={isMobileLocationActive}
          showUserStatus
          showUserStatusAsPopover
          showLanguageToggle={false}
          recenterRequestId={mobileRecenterRequestId}
          routeDestination={activeRouteDestination}
          className="fixed inset-0"
        />

        <div className="pointer-events-none fixed inset-0 z-20 bg-slate-950/10" />

        {session?.user ? (
          <div className="fixed right-3 top-[max(0.75rem,env(safe-area-inset-top))] z-40 flex items-center">
            <Popover open={isMobileAccountOpen} onOpenChange={setIsMobileAccountOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="pointer-events-auto rounded-full border border-slate-700 bg-slate-900 p-0.5 shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label={ui.account}
                >
                  <Avatar className="h-10 w-10 border border-slate-700">
                    <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? ui.account} />
                    <AvatarFallback className="bg-slate-800 text-slate-100">
                      {getUserInitials(session.user.name)}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                className="z-50 mt-2 w-72 rounded-2xl border border-slate-700 bg-slate-950 p-4 text-slate-100 shadow-2xl"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-11 w-11 border border-white/20">
                      <AvatarImage src={session.user.image ?? undefined} alt={session.user.name ?? ui.account} />
                      <AvatarFallback className="bg-slate-800 text-slate-100">
                        {getUserInitials(session.user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-100">
                        {session.user.name ?? ui.account}
                      </p>
                      <p className="truncate text-xs text-slate-400">{session.user.email ?? ui.noEmail}</p>
                      <p className="truncate text-[11px] text-cyan-300">
                        {ui.role}: {session.user.isAdmin === "true" ? ui.admin : ui.operator}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-900 p-3">
                    <p className="mb-2 text-[11px] uppercase tracking-[0.14em] text-slate-400">{ui.language}</p>
                    <LanguageSwitcherCompact />
                  </div>
                  <Button
                    onClick={handleSignOut}
                    size="sm"
                    className="w-full border border-red-500 bg-red-600 text-white hover:bg-red-500"
                  >
                    {ui.signOut}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        ) : null}

        <div className="fixed inset-x-0 bottom-0 z-40 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
          <div className="rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
            <div className="flex w-full items-center justify-between px-2 py-3 sm:px-3">
              <Button
                size="sm"
                variant="outline"
                className="h-11 w-11 border-slate-700 bg-slate-900 px-0 text-slate-100 hover:bg-slate-800"
                onClick={handleMobileSearchOpen}
                aria-label={ui.search}
                title={ui.search}
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-11 w-11 border-slate-700 bg-slate-900 px-0 text-slate-100 hover:bg-slate-800"
                onClick={handleMobileHome}
                aria-label={ui.home}
                title={ui.home}
              >
                <House className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                className={cn(
                  "h-11 w-11 px-0",
                  isMobileLocationActive
                    ? "bg-red-600 text-white hover:bg-red-500"
                    : "border border-red-700 bg-slate-900 text-red-200 hover:bg-slate-800"
                )}
                onClick={handleMobileLocationToggle}
                disabled={isMobileLocationPending}
                aria-label={isMobileLocationPending ? ui.locating : ui.locate}
                title={isMobileLocationPending ? ui.locating : ui.locate}
              >
                <Navigation className={cn("h-4 w-4", isMobileLocationPending ? "animate-pulse" : undefined)} />
              </Button>
              <Button
                size="sm"
                className={cn(
                  "h-11 w-11 px-0",
                  isRouteDialogOpen || Boolean(activeRouteDestination)
                    ? "bg-blue-600 text-white hover:bg-blue-500"
                    : "border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
                )}
                onClick={handleRouteAction}
                aria-label={ui.route}
                title={ui.route}
              >
                <Route className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                className="h-11 w-11 bg-blue-600 px-0 text-white hover:bg-blue-500"
                onClick={() => setIsAnalyticsDialogOpen(true)}
                aria-label={ui.historicalTrends}
                title={ui.historicalTrends}
              >
                <TrendingUp className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <Dialog open={isMobileSearchDialogOpen} onOpenChange={setIsMobileSearchDialogOpen}>
          <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg border-slate-700 bg-slate-950 text-slate-100">
            <DialogHeader>
              <DialogTitle className="font-mono text-base">{ui.search}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{ui.sensorId}</label>
                <Select value={selectedSensor} onValueChange={setSelectedSensor}>
                  <SelectTrigger>
                    <SelectValue placeholder={ui.allSensors} />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    <SelectItem value="all">{ui.allSensors}</SelectItem>
                    {filterOptions.sensors.map((sensor) => (
                      <SelectItem key={sensor} value={sensor}>
                        {sensor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{ui.location}</label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger>
                    <SelectValue placeholder={ui.allLocations} />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    <SelectItem value="all">{ui.allLocations}</SelectItem>
                    {filterOptions.locations.length === 0 ? (
                      <SelectItem value="none" disabled>
                        {ui.noLocationsAvailable}
                      </SelectItem>
                    ) : (
                      filterOptions.locations.map((location) => (
                        <SelectItem key={location} value={location}>
                          {location}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{ui.transportType}</label>
                <Select value={selectedTransportType} onValueChange={setSelectedTransportType}>
                  <SelectTrigger>
                    <SelectValue placeholder={ui.allTypes} />
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    <SelectItem value="all">{ui.allTypes}</SelectItem>
                    {filterOptions.transportTypes.length === 0 ? (
                      <SelectItem value="none" disabled>
                        {ui.noTransportTypesAvailable}
                      </SelectItem>
                    ) : (
                      filterOptions.transportTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{ui.startDate}</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{ui.endDate}</label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedSensor("all");
                    setSelectedLocation("all");
                    setSelectedTransportType("all");
                    setStartDate("");
                    setEndDate("");
                  }}
                >
                  {ui.reset}
                </Button>
                <Badge variant="outline" className="uppercase tracking-wide text-[11px]">
                  <span className="mr-1 font-mono">{filteredReadings.length}</span> {ui.activePoints}
                </Badge>
              </div>
              <Button className="w-full" onClick={() => setIsMobileSearchDialogOpen(false)}>
                {ui.close}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isAnalyticsDialogOpen} onOpenChange={setIsAnalyticsDialogOpen}>
          <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1rem)] flex-col overflow-hidden border-slate-700 bg-slate-950 p-0 sm:max-w-3xl">
            <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4">
              <DialogTitle className="font-mono text-lg">{ui.historicalTrends}</DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{analyticsContent}</div>
          </DialogContent>
        </Dialog>

        <Dialog open={isRouteDialogOpen} onOpenChange={setIsRouteDialogOpen}>
          <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md border-slate-700 bg-slate-950 text-slate-100">
            <DialogHeader>
              <DialogTitle className="font-mono text-base">{ui.route}</DialogTitle>
            </DialogHeader>
            {routeDialogBody}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen">
      <DashboardMapPanel
        key={`desktop-map-${desktopMapKey}`}
        readings={filteredReadings}
        emptyMapText={dict.noGeocodedData}
        recentActivity={activityFeed}
        feedTitle={dict.recentIotData}
        feedEmptyText={dict.noRecentActivity}
        mapHeightClass="h-screen"
        backgroundMode
        showFeedOverlay={false}
        mobileMode={false}
        showLegend={false}
        showLanguageToggle
        useUserLocation={isDesktopLocationActive}
        recenterRequestId={desktopRecenterRequestId}
        showUserStatus
        routeDestination={activeRouteDestination}
      />

      <Button
        size="sm"
        className={cn(
          "fixed right-4 top-1/2 z-50 hidden h-11 w-11 -translate-y-1/2 px-0 lg:inline-flex",
          isDesktopLocationActive
            ? "bg-red-600 text-white hover:bg-red-500"
            : "border border-red-700 bg-slate-900 text-red-200 hover:bg-slate-800"
        )}
        onClick={handleDesktopRecenter}
        aria-label={ui.locate}
        title={ui.locate}
      >
        <Navigation className="h-4 w-4" />
      </Button>

      <div className="fixed bottom-6 right-6 z-50 hidden flex-col gap-3 lg:flex">
        <Button
          onClick={handleDesktopExportReport}
          disabled={filteredReadings.length === 0 || isExportingReport}
          className="h-11 border border-blue-500/60 bg-blue-600 px-4 text-white shadow-lg hover:bg-blue-500"
        >
          <Download className="mr-2 h-4 w-4" />
          {isExportingReport ? ui.exporting : "Download Report"}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              className="h-11 justify-start gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 text-slate-100 shadow-lg hover:bg-slate-800"
            >
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/80" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
              <Activity className="h-4 w-4" />
              <span className="text-sm font-semibold">Recent Readings</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="z-50 w-[340px] p-0">
            <CompactActivityFeed
              title={dict.recentIotData}
              emptyText={dict.noRecentActivity}
              items={activityFeed}
              className="rounded-xl border-slate-700"
            />
          </PopoverContent>
        </Popover>
      </div>

      <section id="map-view" aria-hidden className="h-0" />

      <div className="relative z-10 space-y-6 pb-24 lg:hidden">
        <div className="sticky top-16 z-20 -mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2 rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-xl">
            <Button
              size="sm"
              variant="secondary"
              className="whitespace-nowrap text-sm font-semibold uppercase tracking-wide"
              onClick={() => scrollToSection("particulate-metrics-mobile")}
            >
              {ui.airComposition}
            </Button>
          </div>
        </div>

        <section
          id="particulate-metrics-mobile"
          aria-labelledby="particulate-metrics-mobile-heading"
          className="space-y-4 scroll-mt-28"
        >
          <div className={cn("space-y-4 p-4", overlayPanelClass)}>
            <SectionHeader
              id="particulate-metrics-mobile-heading"
              icon={Microscope}
              title={ui.airCompositionAnalysis}
              className="mb-0 mt-0 border-border/60 pb-3"
            />
            <div className="flex flex-wrap items-center gap-2">
              {leadingStatItems.map((stat) => (
                <Button
                  key={`mobile-leading-${stat.label}`}
                  variant="secondary"
                  className="h-auto justify-start gap-2 px-3 py-2 text-left"
                >
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </span>
                  <span className="font-mono text-sm font-semibold text-foreground">{stat.value}</span>
                </Button>
              ))}
              {renderFilterPopover(mobileFiltersOpen, setMobileFiltersOpen)}
              {trailingStatItems.map((stat) => (
                <Button
                  key={`mobile-trailing-${stat.label}`}
                  variant="secondary"
                  className="h-auto justify-start gap-2 px-3 py-2 text-left"
                >
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {stat.label}
                  </span>
                  <span className="font-mono text-sm font-semibold text-foreground">{stat.value}</span>
                </Button>
              ))}
            </div>
          </div>
        </section>

        <section id="analytics" aria-labelledby="analytics-heading" className="space-y-4 scroll-mt-28">
          <div className={cn("space-y-4 p-4", overlayPanelClass)}>
            <SectionHeader
              id="analytics-heading"
              icon={LineChart}
              title={ui.historicalTrends}
              className="mb-0 mt-0 border-border/60 pb-3"
            />
            {analyticsContent}
          </div>
        </section>

        <section id="nearby-devices" aria-labelledby="nearby-devices-heading" className="space-y-4 scroll-mt-28">
          <div className={cn("space-y-4 p-4", overlayPanelClass)}>
            <SectionHeader
              id="nearby-devices-heading"
              icon={Activity}
              title={nearbyText.title}
              className="mb-0 mt-0 border-border/60 pb-3"
            />
            <NearbyDevicesPanel
              devices={nearbyDevices}
              loading={isNearbyLoading}
              error={hasNearbyError}
              text={nearbyText}
            />
          </div>
        </section>
      </div>

      <Dialog open={isAnalyticsDialogOpen} onOpenChange={setIsAnalyticsDialogOpen}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] flex-col overflow-hidden border-slate-700 bg-slate-950 p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4">
            <DialogTitle className="font-mono text-lg">{ui.historicalTrends}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {analyticsContent}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRouteDialogOpen} onOpenChange={setIsRouteDialogOpen}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md border-slate-700 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle className="font-mono text-base">{ui.route}</DialogTitle>
          </DialogHeader>
          {routeDialogBody}
        </DialogContent>
      </Dialog>
    </div>
  );
}
