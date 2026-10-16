import type { MapPoint } from "../lib/api";

export type AlertMapProps = {
  origin: { lat: number; lng: number };
  radiusM: number;
  points: MapPoint[];
  me?: { lat: number; lng: number } | null;
  height?: number;
};

export const zoneRadiusMeters = (radiusM: number) => radiusM;

// Polígono aproximado de un círculo (para dibujar la zona de juego)
export function circlePolygon(lat: number, lng: number, radiusM: number, steps = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}

export function pointsToGeoJSON(points: MapPoint[], me?: { lat: number; lng: number } | null): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = points.map((p) => ({
    type: "Feature",
    properties: { kind: p.hunter ? "hunter" : "hider" },
    geometry: { type: "Point", coordinates: [p.lng, p.lat] },
  }));
  if (me) {
    features.push({ type: "Feature", properties: { kind: "me" }, geometry: { type: "Point", coordinates: [me.lng, me.lat] } });
  }
  return { type: "FeatureCollection", features };
}

// Esquina suroeste y noreste que encuadran la zona de juego
export function zoneBounds(lat: number, lng: number, radiusM: number): [number, number, number, number] {
  const dLat = (radiusM * 1.25) / 111_320;
  const dLng = (radiusM * 1.25) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [lng - dLng, lat - dLat, lng + dLng, lat + dLat];
}

export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/dark";
