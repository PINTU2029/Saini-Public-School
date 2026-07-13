import React, { ReactNode } from "react";
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { COLORS, SPACING } from "@/src/lib/theme";

interface Props {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: ReactNode;
  children: ReactNode;
  testID?: string;
}

export default function ScreenHeader({ title, subtitle, showBack, right, children, testID }: Props) {
  return (
    <SafeAreaView edges={["top"]} style={styles.safe} testID={testID}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />
      <View style={styles.header}>
        <View style={styles.left}>
          {showBack ? (
            <TouchableOpacity testID="back-button" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={COLORS.textMain} />
            </TouchableOpacity>
          ) : null}
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>
        {right}
      </View>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.md,
    backgroundColor: COLORS.bg,
  },
  left: { flexDirection: "row", alignItems: "center", flex: 1, gap: 6 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 4,
  },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.textMain, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
});
