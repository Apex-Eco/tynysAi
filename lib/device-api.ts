export type DeviceStatus = "online" | "idle" | "offline";

export type DeviceSnapshot = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: DeviceStatus;
  lastSeenAt: string;
};

export type NearbyDevice = DeviceSnapshot & {
  distanceKm: number;
};

type DeviceApiResponse = {
  devices: DeviceSnapshot[];
};

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

export async function fetchNearbyDevices(
  userCoords: { latitude: number; longitude: number },
  limit = 5,
): Promise<NearbyDevice[]> {
  const response = await fetch("/api/v1/sensor-data", {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch devices");
  }

  const payload = (await response.json()) as DeviceApiResponse;

  return payload.devices
    .map((device) => ({
      ...device,
      distanceKm: haversineDistanceKm(
        userCoords.latitude,
        userCoords.longitude,
        device.latitude,
        device.longitude,
      ),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
