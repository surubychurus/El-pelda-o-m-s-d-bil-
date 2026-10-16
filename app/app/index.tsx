import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "../lib/session";

export default function Index() {
  const { player, loading } = useSession();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  return <Redirect href={player ? "/home" : "/nickname"} />;
}
