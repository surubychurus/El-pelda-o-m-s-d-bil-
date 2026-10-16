import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SessionProvider } from "../lib/session";

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerStyle: { backgroundColor: "#111" }, headerTintColor: "#fff", contentStyle: { backgroundColor: "#111" } }} />
    </SessionProvider>
  );
}
