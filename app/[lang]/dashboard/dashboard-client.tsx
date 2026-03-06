"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { DashboardMapPanel } from "./map-panel-client";
import { exportSensorReportPdf } from "@/lib/utils/export-pdf";
import { NearbyDevicesPanel } from "@/components/nearby-devices-panel";
import { SensorChart } from "@/components/sensor-chart";
import { SensorDistribution, type SensorSlice } from "@/components/sensor-distribution";
import { fetchNearbyDevices, type NearbyDevice } from "@/lib/device-api";
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
  MapPin,
  Microscope,
  Radio,
  TrendingUp,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { PolarAngleAxis, RadialBar, RadialBarChart, ResponsiveContainer } from "recharts";

export type SensorReading = {
  id: number;
  timestamp: string;
  sensorId: string;
  value: number;
  location: string | null;
  transportType: string | null;
  ingestedAt: Date | string;
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
    recentReadings: string;
    preparingPdf: string;
    downloadData: string;
    justNow: string;
    airCompositionAnalysis: string;
    average: string;
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
    recentReadings: "Recent Readings",
    preparingPdf: "Preparing PDF...",
    downloadData: "Download Data",
    justNow: "just now",
    airCompositionAnalysis: "Air Composition Analysis",
    average: "Average",
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
    recentReadings: "Последние показания",
    preparingPdf: "Подготовка PDF...",
    downloadData: "Скачать данные",
    justNow: "сейчас",
    airCompositionAnalysis: "Анализ состава воздуха",
    average: "Среднее",
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
    recentReadings: "Соңғы көрсеткіштер",
    preparingPdf: "PDF дайындалуда...",
    downloadData: "Деректерді жүктеу",
    justNow: "қазір",
    airCompositionAnalysis: "Ауа құрамын талдау",
    average: "Орташа",
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

const DEVICE_STATUS_CLASS: Record<NearbyDevice["status"], string> = {
  online: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  idle: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  offline: "bg-slate-500/15 text-slate-300 border-slate-500/40",
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
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [desktopFiltersOpen, setDesktopFiltersOpen] = useState(false);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [isAnalyticsDialogOpen, setIsAnalyticsDialogOpen] = useState(false);
  const [recentReadingsOpen, setRecentReadingsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
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
  }, [readings, selectedSensor, selectedLocation, selectedTransportType, startDate, endDate]);

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
      id: reading.id,
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

  const formatRecentTimestamp = (timestamp: string | Date | null) => {
    if (!timestamp) return ui.justNow;
    const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
    if (Number.isNaN(date.getTime())) return ui.justNow;
    return date.toLocaleTimeString();
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

    const media = window.matchMedia("(max-width: 1023px)");
    const mobileUa =
      /Android|iPhone|iPad|iPod|Mobile|Windows Phone|Opera Mini|IEMobile/i.test(
        window.navigator.userAgent,
      );

    const apply = () => {
      setIsMobileDevice(media.matches || mobileUa);
    };

    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
  }, []);

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
    "rounded-2xl border border-cyan-400/20 bg-slate-950/78 backdrop-blur-md shadow-2xl";

  const scrollToSection = (sectionId: string) => {
    const target = document.getElementById(sectionId);
    if (!target) return;

    const offset = 96;
    const y = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: y, behavior: "smooth" });
  };

  const downloadPdf = async () => {
    if (!filteredReadings.length) return;

    setIsExporting(true);
    try {
      await exportSensorReportPdf(
        filteredReadings.map((reading) => ({
          timestamp: reading.timestamp,
          value: reading.value,
          sensorId: reading.sensorId,
          location: reading.location,
        })),
        {
          projectName: "TynysAi Air Quality Report",
          dateRange: {
            start: startDate ? new Date(startDate) : null,
            end: endDate ? new Date(endDate) : null,
          },
        }
      );
    } catch (error) {
      console.error("Failed to export PDF report:", error);
    } finally {
      setIsExporting(false);
    }
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

  if (isMobileDevice) {
    return (
      <div className="relative isolate min-h-screen space-y-4 pb-24">
        <DashboardMapPanel
          readings={filteredReadings}
          emptyMapText={dict.noGeocodedData}
          recentActivity={activityFeed}
          feedTitle={dict.recentIotData}
          feedEmptyText={dict.noRecentActivity}
          mapHeightClass="h-[70vh] min-h-[480px]"
          backgroundMode={false}
          showFeedOverlay={false}
          mobileMode
        />

        <section className="px-4">
          <NearbyDevicesPanel
            devices={nearbyDevices}
            loading={isNearbyLoading}
            error={hasNearbyError}
            text={nearbyText}
          />
        </section>

        <div className="fixed bottom-6 right-4 z-30">
          <Button
            size="sm"
            className="border border-red-400/45 bg-red-600/90 text-white hover:bg-red-500"
            onClick={handleSignOut}
          >
            {ui.signOut}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative isolate min-h-screen">
      <DashboardMapPanel
        readings={filteredReadings}
        emptyMapText={dict.noGeocodedData}
        recentActivity={activityFeed}
        feedTitle={dict.recentIotData}
        feedEmptyText={dict.noRecentActivity}
        mapHeightClass="h-screen"
        backgroundMode
        showFeedOverlay={false}
        mobileMode={false}
      />

      <section id="map-view" aria-hidden className="h-0 scroll-mt-28" />
      <section id="particulate-metrics" aria-hidden className="h-0 scroll-mt-28" />
      <section id="reports" aria-hidden className="h-0 scroll-mt-28" />

      <div className="fixed bottom-6 left-4 top-20 z-20 hidden lg:block">
        <div className="flex h-full w-[360px] flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/75 p-3 shadow-2xl backdrop-blur-2xl">
          <div className="mt-1 min-h-0 min-w-0 flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
            <div className="rounded-lg border border-white/10 bg-slate-900/55 px-3 py-2.5">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                <Activity className="h-4 w-4 text-cyan-300" />
                {ui.controlPanel}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="justify-start gap-2 whitespace-nowrap border-white/15 bg-slate-900/55 text-sm font-semibold tracking-wide text-slate-100 hover:bg-slate-800/80"
            >
              <Wind className="h-4 w-4 text-cyan-300" />
              {ui.airComposition}
            </Button>
            {leadingStatItems.map((stat) => (
              <div
                key={`desktop-bar-${stat.label}`}
                className="rounded-md border border-white/10 bg-slate-900/50 px-3 py-2"
              >
                <span className="text-xs uppercase tracking-wide text-slate-400">
                  {stat.label}
                </span>
                <p className="font-mono text-base font-semibold text-slate-100">{stat.value}</p>
              </div>
            ))}
            <div className="my-1 flex justify-center">
              {renderFilterPopover(desktopFiltersOpen, setDesktopFiltersOpen)}
            </div>
            {trailingStatItems.map((stat) => (
              <div
                key={`desktop-bar-trailing-${stat.label}`}
                className="rounded-md border border-white/10 bg-slate-900/50 px-3 py-2"
              >
                <span className="text-xs uppercase tracking-wide text-slate-400">
                  {stat.label}
                </span>
                <p className="font-mono text-base font-semibold text-slate-100">{stat.value}</p>
              </div>
            ))}
            <div className="rounded-xl border border-white/10 bg-slate-900/55 p-3">
              <div className="mb-2 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-cyan-300" />
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-300">
                  {nearbyText.title}
                </p>
              </div>

              {isNearbyLoading ? (
                <p className="text-xs text-slate-300">{nearbyText.locating}</p>
              ) : null}

              {!isNearbyLoading && hasNearbyError ? (
                <p className="text-xs text-slate-300">{nearbyText.error}</p>
              ) : null}

              {!isNearbyLoading && !hasNearbyError && nearbyDevices.length === 0 ? (
                <p className="text-xs text-slate-300">{nearbyText.empty}</p>
              ) : null}

              {!isNearbyLoading && !hasNearbyError && nearbyDevices.length > 0 ? (
                <div className="space-y-2">
                  {nearbyDevices.map((device) => (
                    <div
                      key={`desktop-nearby-${device.id}`}
                      className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-slate-950/45 px-2.5 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">{device.name}</p>
                        <p className="font-mono text-xs text-slate-300">
                          {device.distanceKm.toFixed(1)} {nearbyText.kmAway}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("capitalize", DEVICE_STATUS_CLASS[device.status])}
                      >
                        {device.status === "online"
                          ? nearbyText.online
                          : device.status === "idle"
                            ? nearbyText.idle
                            : nearbyText.offline}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-2">
              <Button
                size="sm"
                variant="outline"
                className="justify-start gap-2 whitespace-nowrap border-white/15 bg-slate-900/55 text-sm font-semibold tracking-wide text-slate-100 hover:bg-slate-800/80"
                onClick={() => setIsAnalyticsDialogOpen(true)}
              >
                <TrendingUp className="h-4 w-4 text-cyan-300" />
                {ui.openTrends}
              </Button>
            </div>
            <div className="my-1 h-px bg-slate-700/70" />
            <div className="rounded-xl border border-white/10 bg-slate-900/55 p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8 border border-slate-600">
                  <AvatarImage src={session?.user?.image ?? undefined} alt={session?.user?.name ?? ui.account} />
                  <AvatarFallback className="bg-slate-800 text-slate-100">
                    {getUserInitials(session?.user?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">{session?.user?.name ?? ui.account}</p>
                  <p className="truncate text-xs text-slate-400">{session?.user?.email ?? ui.noEmail}</p>
                  <p className="truncate text-[11px] text-cyan-300">
                    {ui.role}: {session?.user?.isAdmin === "true" ? ui.admin : ui.operator}
                  </p>
                </div>
              </div>
              <Button
                onClick={handleSignOut}
                size="sm"
                className="mt-3 w-full border border-red-400/45 bg-red-600/90 text-white hover:bg-red-500"
              >
                {ui.signOut}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 space-y-6 pb-24 lg:hidden">
        <div className="sticky top-16 z-20 -mx-1 overflow-x-auto pb-1">
          <div className="flex min-w-max gap-2 rounded-xl border border-border/70 bg-background/75 p-2 shadow-xl backdrop-blur-lg">
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
        <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-2rem)] flex-col overflow-hidden border-border/70 bg-background/95 p-0 backdrop-blur-lg sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4">
            <DialogTitle className="font-mono text-lg">{ui.historicalTrends}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {analyticsContent}
          </div>
        </DialogContent>
      </Dialog>

      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-2">
        <Popover open={recentReadingsOpen} onOpenChange={setRecentReadingsOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="secondary"
              className="flex items-center gap-3 rounded-full px-4 pr-5 shadow-lg backdrop-blur"
            >
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/80" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
              </span>
              <Activity className="h-4 w-4" />
              <span className="whitespace-nowrap text-sm font-semibold">{ui.recentReadings}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="z-50 w-[320px] p-0 sm:w-[360px]">
            <div className="max-h-72 overflow-y-auto px-2 py-2">
              {activityFeed.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">{dict.noRecentActivity}</p>
              ) : (
                <div className="space-y-1.5">
                  {activityFeed.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-muted/60"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="relative flex h-2 w-2 items-center justify-center">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                        </span>
                        <span className="truncate text-sm font-medium text-foreground">{item.sensorId}</span>
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatRecentTimestamp(item.timestamp)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          onClick={downloadPdf}
          disabled={isExporting || filteredReadings.length === 0}
          className="gap-2 rounded-full px-5 shadow-xl"
        >
          <Download className="h-4 w-4" />
          {isExporting ? ui.preparingPdf : ui.downloadData}
        </Button>
      </div>
    </div>
  );
}
