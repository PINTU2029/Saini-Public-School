import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/src/lib/AuthContext";
import { useLang } from "@/src/lib/LanguageContext";
import { api } from "@/src/lib/api";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";
import ProgressRing from "@/src/components/ProgressRing";
import Badge from "@/src/components/Badge";

interface AttData {
  percentage: number;
  present: number;
  absent: number;
  late: number;
  total: number;
}

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLang();
  const [refreshing, setRefreshing] = useState(false);
  const [attendance, setAttendance] = useState<AttData | null>(null);
  const [homework, setHomework] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [bus, setBus] = useState<any | null>(null);
  const [adminStats, setAdminStats] = useState<any | null>(null);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [nts, bs] = await Promise.all([api.get("/notices"), api.get("/bus/BUS-01").catch(() => null)]);
      setNotices(nts);
      setBus(bs);
    } catch {}

    try {
      if (user.role === "student") {
        const [att, hw, fs] = await Promise.all([
          api.get(`/attendance/student/${user.user_id}`),
          api.get(`/homework`),
          api.get(`/fees/student/${user.user_id}`),
        ]);
        setAttendance(att);
        setHomework(hw);
        setFees(fs);
      } else if (user.role === "parent" && user.child_ids && user.child_ids.length) {
        const childId = user.child_ids[0];
        const [att, hw, fs] = await Promise.all([
          api.get(`/attendance/student/${childId}`),
          api.get(`/homework?class_id=cls_10a`),
          api.get(`/fees/student/${childId}`),
        ]);
        setAttendance(att);
        setHomework(hw);
        setFees(fs);
      } else if (user.role === "teacher") {
        const [hw, lv] = await Promise.all([
          api.get(`/homework?class_id=${user.class_id ?? "cls_10a"}`),
          api.get(`/leaves?status=pending`),
        ]);
        setHomework(hw);
        setPendingLeaves(lv);
      } else if (user.role === "admin") {
        const stats = await api.get("/dashboard/admin");
        setAdminStats(stats);
      }
    } catch (e) {
      // ignore
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const pendingFees = fees.filter((f) => f.status === "pending");
  const totalPending = pendingFees.reduce((s, f) => s + f.amount, 0);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: COLORS.bg }} testID="home-screen">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{t("welcome")}, </Text>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.name}
            </Text>
            <Text style={styles.roleTag}>{user?.role.toUpperCase()}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              testID="lang-toggle-home"
              style={styles.iconBtn}
              onPress={() => setLang(lang === "en" ? "hi" : "en")}
            >
              <Text style={styles.iconBtnText}>{lang === "en" ? "हिं" : "EN"}</Text>
            </TouchableOpacity>
            <TouchableOpacity testID="logout-button" style={styles.iconBtn} onPress={logout}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.textMain} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Student / Parent widgets */}
        {(user?.role === "student" || user?.role === "parent") && attendance && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{t("attendance")}</Text>
              <TouchableOpacity onPress={() => router.push("/attendance")} testID="view-attendance-btn">
                <Text style={styles.link}>View →</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.attRow}>
              <ProgressRing percentage={attendance.percentage} label={t("overall")} sublabel={`${attendance.present}/${attendance.total} days`} />
              <View style={{ flex: 1, gap: 10, paddingLeft: 20 }}>
                <StatChip label={t("present")} value={attendance.present} color={COLORS.success} />
                <StatChip label={t("absent")} value={attendance.absent} color={COLORS.error} />
                <StatChip label={t("late")} value={attendance.late} color={COLORS.warning} />
              </View>
            </View>
          </View>
        )}

        {/* Fee reminder banner */}
        {(user?.role === "student" || user?.role === "parent") && pendingFees.length > 0 && (
          <TouchableOpacity
            style={styles.feeBanner}
            onPress={() => router.push("/fees")}
            testID="fee-banner"
          >
            <View style={styles.feeIcon}>
              <Ionicons name="card" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.feeTitle}>₹{totalPending.toLocaleString()} {t("pending")}</Text>
              <Text style={styles.feeSubtitle}>{pendingFees.length} fee(s) due — tap to pay</Text>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Pending homework */}
        {(user?.role === "student" || user?.role === "parent" || user?.role === "teacher") && homework.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{t("homework")}</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/diary")}>
                <Text style={styles.link}>All →</Text>
              </TouchableOpacity>
            </View>
            {homework.slice(0, 3).map((h) => (
              <View key={h.homework_id} style={styles.hwItem}>
                <View style={styles.hwIcon}>
                  <Ionicons name="document-text" size={18} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.hwTitle} numberOfLines={1}>{h.title}</Text>
                  <Text style={styles.hwMeta}>{h.subject} • Due {h.due_date}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Bus tracking */}
        {(user?.role === "student" || user?.role === "parent") && bus && (
          <TouchableOpacity
            style={styles.busCard}
            onPress={() => router.push("/bus-tracking")}
            testID="bus-mini"
          >
            <View style={styles.busIconWrap}>
              <Ionicons name="bus" size={22} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.busTitle}>Bus {bus.bus_id} — ETA {bus.eta_minutes} min</Text>
              <Text style={styles.busSub}>Next stop: {bus.next_stop}</Text>
            </View>
            <Badge label="LIVE" variant="success" small />
          </TouchableOpacity>
        )}

        {/* Teacher widgets */}
        {user?.role === "teacher" && (
          <>
            <View style={styles.quickGrid}>
              <QuickAction
                icon="checkbox"
                label={t("mark_attendance")}
                onPress={() => router.push("/teacher-attendance")}
                testID="quick-mark-attendance"
              />
              <QuickAction
                icon="cloud-upload"
                label={t("post_homework")}
                onPress={() => router.push("/teacher-homework")}
                testID="quick-post-homework"
              />
              <QuickAction
                icon="megaphone"
                label={t("notices")}
                onPress={() => router.push("/admin-broadcasts")}
                testID="quick-notice"
              />
              <QuickAction
                icon="mail"
                label="Leaves"
                onPress={() => router.push("/leaves")}
                testID="quick-leaves"
              />
            </View>

            {pendingLeaves.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Pending Leave Requests</Text>
                {pendingLeaves.slice(0, 3).map((l) => (
                  <View key={l.leave_id} style={styles.hwItem}>
                    <View style={styles.hwIcon}>
                      <Ionicons name="calendar" size={18} color={COLORS.warning} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hwTitle}>{l.reason}</Text>
                      <Text style={styles.hwMeta}>{l.from_date} to {l.to_date} • by {l.requested_by_name}</Text>
                    </View>
                    <Badge label="PENDING" variant="warning" small />
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Admin dashboard */}
        {user?.role === "admin" && adminStats && (
          <>
            <View style={styles.statsGrid}>
              <StatCard icon="people" label="Students" value={adminStats.total_students} color={COLORS.primary} />
              <StatCard icon="school" label="Teachers" value={adminStats.total_teachers} color={COLORS.terracotta} />
              <StatCard icon="checkmark-circle" label="Present Today" value={`${adminStats.today_present}/${adminStats.today_marked}`} color={COLORS.success} />
              <StatCard icon="card" label="Fees Paid" value={adminStats.fees_paid} color={COLORS.secondary} />
              <StatCard icon="hourglass" label="Fees Pending" value={adminStats.fees_pending} color={COLORS.warning} />
              <StatCard icon="mail-unread" label="Pending Leaves" value={adminStats.pending_leaves} color={COLORS.error} />
            </View>

            <View style={styles.quickGrid}>
              <QuickAction icon="megaphone" label={t("admin_broadcast")} onPress={() => router.push("/admin-broadcasts")} testID="quick-broadcast" />
              <QuickAction icon="cash" label="Fees Overview" onPress={() => router.push("/admin-fees")} testID="quick-admin-fees" />
              <QuickAction icon="bus" label={t("bus_tracking")} onPress={() => router.push("/bus-tracking")} testID="quick-bus" />
              <QuickAction icon="images" label={t("gallery")} onPress={() => router.push("/gallery")} testID="quick-gallery" />
              <QuickAction icon="library" label={t("lms")} onPress={() => router.push("/lms")} testID="quick-lms" />
            </View>
          </>
        )}

        {/* Latest notice */}
        {notices.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Latest Notice</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/diary")}>
                <Text style={styles.link}>All →</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.noticeItem}>
              <Badge
                label={notices[0].category.toUpperCase()}
                variant={notices[0].category === "urgent" ? "error" : notices[0].category === "holiday" ? "info" : "default"}
                small
              />
              <Text style={styles.noticeTitle}>{notices[0].title}</Text>
              <Text style={styles.noticeBody} numberOfLines={3}>{notices[0].body}</Text>
            </View>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text style={{ fontSize: 13, color: COLORS.textMuted, flex: 1 }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: "800", color: COLORS.textMain }}>{value}</Text>
    </View>
  );
}

function QuickAction({ icon, label, onPress, testID }: { icon: any; label: string; onPress: () => void; testID?: string }) {
  return (
    <TouchableOpacity style={styles.quick} onPress={onPress} testID={testID}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
      </View>
      <Text style={styles.quickLabel} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatCard({ icon, label, value, color }: { icon: any; label: string; value: any; color: string }) {
  return (
    <View style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, paddingBottom: 40, gap: SPACING.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.sm },
  greeting: { color: COLORS.textMuted, fontSize: 14 },
  userName: { fontSize: 24, fontWeight: "800", color: COLORS.textMain, letterSpacing: -0.3, marginTop: 2 },
  roleTag: { fontSize: 10, fontWeight: "700", color: COLORS.primary, letterSpacing: 1.2, marginTop: 4 },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.border,
  },
  iconBtnText: { fontWeight: "700", color: COLORS.primary, fontSize: 12 },

  card: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 12,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontSize: 17, fontWeight: "800", color: COLORS.textMain },
  link: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },

  attRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },

  feeBanner: {
    backgroundColor: COLORS.terracotta,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  feeIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  feeTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },
  feeSubtitle: { color: "rgba(255,255,255,0.9)", fontSize: 12, marginTop: 2 },

  hwItem: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  hwIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.chipBg, alignItems: "center", justifyContent: "center" },
  hwTitle: { fontSize: 14, fontWeight: "700", color: COLORS.textMain },
  hwMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  busCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  busIconWrap: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.chipBg,
    alignItems: "center", justifyContent: "center",
  },
  busTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textMain },
  busSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quick: {
    width: "48%",
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  quickIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.chipBg, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 14, fontWeight: "700", color: COLORS.textMain },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: {
    width: "48%",
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 22, fontWeight: "800", color: COLORS.textMain, marginTop: 4 },
  statLabel: { fontSize: 12, color: COLORS.textMuted },

  noticeItem: { gap: 6 },
  noticeTitle: { fontSize: 15, fontWeight: "700", color: COLORS.textMain, marginTop: 6 },
  noticeBody: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
});
