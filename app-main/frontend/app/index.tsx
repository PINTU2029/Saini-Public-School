import { Redirect } from "expo-router";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useAuth } from "@/src/lib/AuthContext";
import { COLORS } from "@/src/lib/theme";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.text}>Vidya Sahaayak</Text>
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  return <Redirect href="/(tabs)/home" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", gap: 12 },
  text: { fontSize: 18, color: COLORS.primary, fontWeight: "600" },
});