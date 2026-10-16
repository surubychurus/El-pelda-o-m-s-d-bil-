import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { colors } from "../lib/theme";
import { useSession } from "../lib/session";

export default function Index() {
  const { player, loading } = useSession();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.hunter} />
      </View>
    );
  }
  return <Redirect href={player ? "/home" : "/nickname"} />;
}
