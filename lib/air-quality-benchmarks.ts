export type AirQualityBenchmark = {
  pollutant: string;
  averagingPeriod: string;
  guidelineValue: number;
  unit: string;
  standardType: "WHO" | "National";
  source: string;
};

export const AIR_QUALITY_BENCHMARKS: AirQualityBenchmark[] = [
  {
    pollutant: "PM2.5",
    averagingPeriod: "24-hour mean",
    guidelineValue: 15,
    unit: "µg/m³",
    standardType: "WHO",
    source: "WHO AQG 2021",
  },
  {
    pollutant: "PM2.5",
    averagingPeriod: "Annual mean",
    guidelineValue: 5,
    unit: "µg/m³",
    standardType: "WHO",
    source: "WHO AQG 2021",
  },
  {
    pollutant: "PM10",
    averagingPeriod: "24-hour mean",
    guidelineValue: 45,
    unit: "µg/m³",
    standardType: "WHO",
    source: "WHO AQG 2021",
  },
  {
    pollutant: "PM10",
    averagingPeriod: "Annual mean",
    guidelineValue: 15,
    unit: "µg/m³",
    standardType: "WHO",
    source: "WHO AQG 2021",
  },
  {
    pollutant: "NO₂",
    averagingPeriod: "24-hour mean",
    guidelineValue: 25,
    unit: "µg/m³",
    standardType: "WHO",
    source: "WHO AQG 2021",
  },
  {
    pollutant: "NO₂",
    averagingPeriod: "Annual mean",
    guidelineValue: 10,
    unit: "µg/m³",
    standardType: "WHO",
    source: "WHO AQG 2021",
  },
  {
    pollutant: "O₃",
    averagingPeriod: "Peak season mean (8-hour max)",
    guidelineValue: 60,
    unit: "µg/m³",
    standardType: "WHO",
    source: "WHO AQG 2021",
  },
  {
    pollutant: "PM2.5",
    averagingPeriod: "24-hour mean",
    guidelineValue: 35,
    unit: "µg/m³",
    standardType: "National",
    source: "US EPA NAAQS",
  },
  {
    pollutant: "PM2.5",
    averagingPeriod: "Annual mean",
    guidelineValue: 9,
    unit: "µg/m³",
    standardType: "National",
    source: "US EPA NAAQS",
  },
  {
    pollutant: "PM10",
    averagingPeriod: "24-hour mean",
    guidelineValue: 150,
    unit: "µg/m³",
    standardType: "National",
    source: "US EPA NAAQS",
  },
];

export const AIR_QUALITY_BENCHMARKS_TITLE = "Air-quality benchmark thresholds";
export const AIR_QUALITY_BENCHMARKS_SUBTITLE =
  "WHO and national standards to compare against live sensor readings.";
