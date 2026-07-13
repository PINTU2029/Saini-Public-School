import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "@/src/lib/theme";

interface Props {
  size?: number;
  strokeWidth?: number;
  percentage: number;
  label?: string;
  sublabel?: string;
  color?: string;
}

export default function ProgressRing({
  size = 130,
  strokeWidth = 12,
  percentage,
  label,
  sublabel,
  color = COLORS.primary,
}: Props) {
  const pct = Math.max(0, Math.min(100, percentage));
  // Simplified ring using overlapping colored view with rotation cannot easily represent partial ring without SVG.
  // Fallback: a solid circle with pct in center and a colored arc effect via border colors.
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <View
        style={[
          styles.outer,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: COLORS.border,
          },
        ]}
      />
      <View
        style={[
          styles.arc,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: strokeWidth,
            borderColor: color,
            borderRightColor: pct < 25 ? COLORS.border : color,
            borderBottomColor: pct < 50 ? COLORS.border : color,
            borderLeftColor: pct < 75 ? COLORS.border : color,
            transform: [{ rotate: "-45deg" }],
            opacity: 0.95,
          },
        ]}
      />
      <View style={styles.center}>
        <Text style={[styles.pct, { color }]}>{pct.toFixed(0)}%</Text>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  outer: { position: "absolute" },
  arc: { position: "absolute" },
  center: { alignItems: "center", justifyContent: "center" },
  pct: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  label: { fontSize: 12, color: COLORS.textMuted, marginTop: 2, fontWeight: "600" },
  sublabel: { fontSize: 10, color: COLORS.textMuted, marginTop: 1 },
});
