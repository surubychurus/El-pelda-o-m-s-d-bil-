import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "../lib/tracking"; // registra la tarea de ubicación en segundo plano
import { SessionProvider } from "../lib/session";
import { colors } from "../lib/theme";

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </SessionProvider>
  );
}
