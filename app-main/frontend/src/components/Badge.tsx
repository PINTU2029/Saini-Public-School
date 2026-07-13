import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, RADII } from "@/src/lib/theme";

interface Props {
  label: string;
  variant?: "success" | "warning" | "error" | "info" | "default";
  small?: boolean;
}

const VARIANTS: Record<string, { bg: string; fg: string }> = {
  success: { bg: "#E6F7EF", fg: COLORS.success },
  warning: { bg: "#FEF3E2", fg: COLORS.warning },
  error: { bg: "#FDECEC", fg: COLORS.error },
  info: { bg: "#EAF0FB", fg: "#2E6FDB" },
  default: { bg: COLORS.chipBg, fg: COLORS.primary },
};

export default function Badge({ label, variant = "default", small }: Props) {
  const v = VARIANTS[variant];
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: v.bg,
          paddingHorizontal: small ? 8 : 10,
          paddingVertical: small ? 3 : 5,
        },
      ]}
    >
      <Text style={[styles.text, { color: v.fg, fontSize: small ? 11 : 12 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: RADII.sm, alignSelf: "flex-start" },
  text: { fontWeight: "700", letterSpacing: 0.2 },
});
