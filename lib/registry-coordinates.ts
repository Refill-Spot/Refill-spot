import proj4 from "proj4";

// EPSG registry definition for Korean 1985 / Modified Central Belt.
const EPSG5174 =
  "+proj=tmerc +lat_0=38 +lon_0=127.002890277778 +k=1 +x_0=200000 +y_0=500000 +ellps=bessel +towgs84=-145.907,505.034,685.756,-1.162,2.347,1.592,6.342 +units=m +no_defs";
export function registryCoordinates(x: string, y: string) {
  if (!x.trim() || !y.trim()) throw Error("Missing projected coordinates");
  const values = [Number(x), Number(y)];
  if (!values.every(Number.isFinite) || values.some((value) => value === 0))
    throw Error("Invalid projected coordinates");
  const [lng, lat] = proj4(EPSG5174, "EPSG:4326", values);
  // Broad Seoul bounding box is a safety check, not proof of administrative membership.
  if (lat < 37.4 || lat > 37.72 || lng < 126.75 || lng > 127.2)
    throw Error("Coordinates outside Seoul bounds");
  return { lat, lng };
}
export function coordinateDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
