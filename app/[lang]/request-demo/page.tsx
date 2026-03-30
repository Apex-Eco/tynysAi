import { MapPinned, PlugZap, Wifi, Wind } from "lucide-react";

const STEPS = [
  {
    id: 1,
    title: "Power On",
    description: "Tynys sensor device plugs into power.",
    Icon: PlugZap,
  },
  {
    id: 2,
    title: "Auto WiFi Connect",
    description: "Device connects to WiFi automatically.",
    Icon: Wifi,
  },
  {
    id: 3,
    title: "Air Quality Sampling",
    description: "Sensor reads PM2.5, PM10, CO2, temperature, and humidity.",
    Icon: Wind,
  },
  {
    id: 4,
    title: "Live Map Updates",
    description: "Data appears on the map every 5 seconds.",
    Icon: MapPinned,
  },
] as const;

export default function RequestDemoPage() {
  return (
    <div className="px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-300">TynysAi</p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-100 sm:text-4xl">How It Works</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
            Simple setup. Live air quality visibility for your route in minutes.
          </p>
        </div>

        <ol className="grid gap-4 md:grid-cols-2" aria-label="How TynysAi devices work">
          {STEPS.map((step) => (
            <li key={step.id} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-500/15 text-sm font-semibold text-cyan-200">
                  {step.id}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <step.Icon className="h-4 w-4 text-cyan-300" aria-hidden />
                    <h2 className="text-base font-semibold text-zinc-100">{step.title}</h2>
                  </div>
                  <p className="mt-2 text-sm text-slate-300">{step.description}</p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
