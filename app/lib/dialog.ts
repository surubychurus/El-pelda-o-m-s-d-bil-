import { Alert, Platform, Share } from "react-native";

// Alert.alert no hace nada en navegador, así que en web se usan los diálogos del navegador
export function notify(title: string, message?: string) {
  if (Platform.OS === "web") window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

export function confirmAction(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === "web") return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
      { text: confirmLabel, style: "destructive", onPress: () => resolve(true) },
    ]),
  );
}

export async function shareText(message: string) {
  if (Platform.OS === "web") {
    try {
      await navigator.clipboard.writeText(message);
      notify("Copiado", "Pégalo en tu chat para compartirlo.");
    } catch {
      notify("Comparte este texto", message);
    }
    return;
  }
  await Share.share({ message });
}
