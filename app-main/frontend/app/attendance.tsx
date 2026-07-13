import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl } from "react-native";
import ScreenHeader from "@/src/components/ScreenHeader";
import ProgressRing from "@/src/components/ProgressRing";
import Badge from "@/src/components/Badge";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/AuthContext";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";

export default function AttendanceScreen() {
  const { user } = useAuth();
  const { t } = useLang();
  const [data, setData] = useState<any | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const studentId =
    user?.role === "student"
      ? user.user_id
      : user?.role === "parent" && user.child_ids?.length
      ? user.child_ids[0]
      : null;

  const load = useCallback(async () => {
    if (!studentId) return;
    const res = await api.get(`/attendance/student/${studentId}`);
    setData(res);
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ScreenHeader title={t("attendance")} showBack>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {data && (
          <>
            <View style={styles.card}>
              <View style={{ alignItems: "center" }}>
                <ProgressRing percentage={data.percentage} size={160} strokeWidth={14} label={t("overall")} sublabel={`${data.present}/${data.total} days`} />
              </View>
              <View style={styles.summaryRow}>
                <SummaryPill label={t("present")} value={data.present} color={COLORS.success} />
                <SummaryPill label={t("absent")} value={data.absent} color={COLORS.error} />
                <SummaryPill label={t("late")} value={data.late} color={COLORS.warning} />
              </View>
            </View>

            <Text style={styles.h}>Recent Days</Text>
            {data.records.slice(0, 30).map((r: any) => (
              <View key={r.date} style={styles.row}>
                <Text style={styles.date}>{r.date}</Text>
                <Badge
                  label={r.status.toUpperCase()}
                  variant={r.status === "present" ? "success" : r.status === "late" ? "warning" : "error"}
                  small
                />
              </View>
            ))}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenHeader>
  );
}

function SummaryPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.pill}>
      <View style={[styles.pillDot, { backgroundColor: color }]} />
      <Text style={styles.pillValue}>{value}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, gap: 12 },
  card: {
    backgroundColor: COLORS.surface,
    padding: SPACING.xl,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: SPACING.lg,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  pill: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: RADII.lg,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  pillValue: { fontSize: 20, fontWeight: "800", color: COLORS.textMain },
  pillLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  h: { fontSize: 14, fontWeight: "800", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginTop: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  date: { fontSize: 14, color: COLORS.textMain, fontWeight: "600" },
});