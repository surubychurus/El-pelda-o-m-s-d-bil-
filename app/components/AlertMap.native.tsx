// Versión iOS/Android con MapLibre y los mapas gratuitos de OpenFreeMap (sin clave)
import { Camera, GeoJSONSource, Layer, Map } from "@maplibre/maplibre-react-native";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { colors } from "../lib/theme";
import { circlePolygon, MAP_STYLE_URL, pointsToGeoJSON, zoneBounds, type AlertMapProps } from "./alertMapShared";

export function AlertMap({ origin, radiusM, points, me, height = 340 }: AlertMapProps) {
  const zone = useMemo(() => circlePolygon(origin.lat, origin.lng, radiusM), [origin.lat, origin.lng, radiusM]);
  const pts = useMemo(() => pointsToGeoJSON(points, me), [points, me]);
  const bounds = useMemo(() => zoneBounds(origin.lat, origin.lng, radiusM), [origin.lat, origin.lng, radiusM]);

  return (
    <View style={[s.wrap, { height }]}>
      <Map style={StyleSheet.absoluteFill} mapStyle={MAP_STYLE_URL} touchRotate={false} touchPitch={false} attribution>
        <Camera initialViewState={{ bounds, padding: { top: 16, right: 16, bottom: 16, left: 16 } }} />

        <GeoJSONSource id="zone" data={zone}>
          <Layer id="zone-fill" type="fill" paint={{ "fill-color": colors.hunter, "fill-opacity": 0.07 }} />
          <Layer id="zone-line" type="line" paint={{ "line-color": colors.hunter, "line-width": 2, "line-opacity": 0.8 }} />
        </GeoJSONSource>

        <GeoJSONSource id="players" data={pts}>
          <Layer
            id="players-dots"
            type="circle"
            paint={{
              "circle-radius": ["match", ["get", "kind"], "hunter", 10, "me", 7, 7],
              "circle-color": ["match", ["get", "kind"], "hunter", colors.hunter, "me", "#ffffff", colors.hider],
              "circle-stroke-color": "#ffffff",
              "circle-stroke-width": 2,
            }}
          />
        </GeoJSONSource>
      </Map>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border, backgroundColor: "#0b0d14" },
});
