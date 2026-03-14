export type AqiCategory = "low" | "medium" | "high" | "unknown";

interface ClassificationResult {
  category: AqiCategory;
  rule: string;
}

function isFiniteNumber(value?: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeAgainstUpperBound(value: number, upperBound: number) {
  return clamp(value / upperBound, 0, 1.5);
}

function normalizeComfortBand(value: number, lower: number, upper: number, span: number) {
  if (value >= lower && value <= upper) return 0;
  const deviation = value < lower ? lower - value : value - upper;
  return clamp(deviation / span, 0, 1.5);
}

// Classifies particulate readings into simple bands from the referenced paper
export function classifyAqiCategory(
  pm25?: number | null,
  pm10?: number | null,
  co2?: number | null,
  temp?: number | null,
  hum?: number | null,
): ClassificationResult {
  const hasPm25 = isFiniteNumber(pm25);
  const hasPm10 = isFiniteNumber(pm10);
  const hasCo2 = isFiniteNumber(co2);
  const hasTemp = isFiniteNumber(temp);
  const hasHum = isFiniteNumber(hum);

  const thresholds = {
    pm25: { medium: 25, high: 50 },
    pm10: { medium: 50, high: 100 },
  } as const;

  // Keep the existing particulate-only behavior when no supporting metrics are present.
  if (!hasCo2 && !hasTemp && !hasHum) {
    const overHigh = (hasPm25 && pm25! > thresholds.pm25.high) || (hasPm10 && pm10! > thresholds.pm10.high);
    if (overHigh) {
      return { category: "high", rule: "PM2.5 > 50 or PM10 > 100" };
    }

    const inMediumBand = (hasPm25 && pm25! >= thresholds.pm25.medium && pm25! <= thresholds.pm25.high)
      || (hasPm10 && pm10! >= thresholds.pm10.medium && pm10! <= thresholds.pm10.high);
    if (inMediumBand) {
      return { category: "medium", rule: "PM2.5 25-50 or PM10 50-100" };
    }

    if (hasPm25 || hasPm10) {
      const pm25LowOk = !hasPm25 || pm25! < thresholds.pm25.medium;
      const pm10LowOk = !hasPm10 || pm10! < thresholds.pm10.medium;
      if (pm25LowOk && pm10LowOk) {
        return { category: "low", rule: "PM2.5 < 25 and PM10 < 50" };
      }
    }

    return { category: "unknown", rule: "Insufficient particulate data" };
  }

  const weightedParts: Array<{ score: number; weight: number; label: string }> = [];

  if (hasPm25) {
    weightedParts.push({
      score: normalizeAgainstUpperBound(pm25!, thresholds.pm25.high),
      weight: 0.35,
      label: "pm25",
    });
  }

  if (hasPm10) {
    weightedParts.push({
      score: normalizeAgainstUpperBound(pm10!, thresholds.pm10.high),
      weight: 0.25,
      label: "pm10",
    });
  }

  if (hasCo2) {
    // Baseline comfort around 400ppm; higher values increase risk.
    weightedParts.push({
      score: normalizeAgainstUpperBound(Math.max(0, co2! - 400), 1000),
      weight: 0.2,
      label: "co2",
    });
  }

  if (hasTemp) {
    weightedParts.push({
      score: normalizeComfortBand(temp!, 18, 27, 10),
      weight: 0.1,
      label: "temp",
    });
  }

  if (hasHum) {
    weightedParts.push({
      score: normalizeComfortBand(hum!, 30, 60, 30),
      weight: 0.1,
      label: "hum",
    });
  }

  if (weightedParts.length === 0) {
    return { category: "unknown", rule: "Insufficient readings for AQI" };
  }

  const totalWeight = weightedParts.reduce((sum, metric) => sum + metric.weight, 0);
  const weightedScore = weightedParts.reduce((sum, metric) => sum + metric.score * metric.weight, 0) / totalWeight;

  const scaledScore = clamp(weightedScore * 100, 0, 150);
  const usedMetrics = weightedParts.map((metric) => metric.label).join(", ");

  if (scaledScore >= 75) {
    return { category: "high", rule: `Composite AQI high (${usedMetrics})` };
  }

  if (scaledScore >= 45) {
    return { category: "medium", rule: `Composite AQI medium (${usedMetrics})` };
  }

  return { category: "low", rule: `Composite AQI low (${usedMetrics})` };
}
