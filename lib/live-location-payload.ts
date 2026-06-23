/**
 * Expo / iOS use -1 for unknown speed, heading, or accuracy (see LocationObject.coords).
 * Our API expects either a valid number or the field omitted.
 */
function optionalCoordField(n: number | null | undefined): number | undefined {
  if (n == null || !Number.isFinite(n) || n === -1) return undefined;
  return n;
}

export function buildLiveLocationPayload(coords: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
}): { lat: number; lng: number; accuracy?: number; heading?: number; speed?: number } {
  const accuracy = optionalCoordField(coords.accuracy);
  const heading = optionalCoordField(coords.heading);
  const speed = optionalCoordField(coords.speed);
  const out: { lat: number; lng: number; accuracy?: number; heading?: number; speed?: number } = {
    lat: coords.latitude,
    lng: coords.longitude,
  };
  if (accuracy !== undefined) out.accuracy = accuracy;
  if (heading !== undefined) out.heading = heading;
  if (speed !== undefined) out.speed = speed;
  return out;
}
