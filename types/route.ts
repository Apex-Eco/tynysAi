export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type RouteAqiBand = "good" | "moderate" | "usg" | "unhealthy" | "very-unhealthy" | "hazardous";

export type GoodAirOption = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  aqi: number;
  aqiBand: RouteAqiBand;
  distanceKm: number;
};

export type NearestGoodAirResponse = {
  options: GoodAirOption[];
  source: Coordinates;
  generatedAt: string;
  message?: string;
};

export type RouteRequestBody = {
  source: Coordinates;
  destination: Coordinates;
};

export type RouteGeometryResponse = {
  geometry: [number, number][];
  distanceMeters: number;
  durationSeconds: number;
  steps?: RouteStep[];
};

export type RouteStep = {
  distanceMeters: number;
  durationSeconds: number;
  instruction: string;
  maneuverType?: string;
  maneuverModifier?: string;
  name?: string;
};