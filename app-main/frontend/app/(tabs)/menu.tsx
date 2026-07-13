import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { useAuth } from "@/src/lib/AuthContext";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";

interface MenuItem {
  key: string;
  icon: any;
  label: string;
  route: string;
  roles: string[];
  color: string;
}

export default function MenuScreen() {
  const { user, logout } = useAuth();
  const { t, lang, setLang } = useLang();

  const items: MenuItem[] = [
    //  FIX: 'parent' hataya taaki parent ke dashboard par Attendance na dikhe
    { key: "att", icon: "checkbox-outline", label: t("attendance"), route: "/attendance", roles: ["student"], color: COLORS.primary },
    
    //  FIX: 'parent' hataya taaki parent ke dashboard par Fees na dikhe
    { key: "fees", icon: "card-outline", label: t("fees"), route: "/fees", roles: ["student"], color: COLORS.terracotta },
    
    //  Report Card Display Dashboard Dashboard Access
    { key: "report", icon: "clipboard-outline", label: t("report_card"), route: "/report-card", roles: ["student", "parent", "teacher", "admin"], color: COLORS.secondary },
    
    //  NEW: Create Report Card option locked solely for Admin operations matrix
    { key: "createreport", icon: "add-circle-outline", label: "Create Report Card", route: "/admin-create-report", roles: ["admin"], color: COLORS.primary },
    
    { key: "tt", icon: "calendar-outline", label: t("timetable"), route: "/timetable", roles: ["student", "parent", "teacher", "admin"], color: COLORS.primaryLight },
    { key: "bus", icon: "bus-outline", label: t("bus_tracking"), route: "/bus-tracking", roles: ["student", "parent", "admin"], color: COLORS.warning },
    { key: "gallery", icon: "images-outline", label: t("gallery"), route: "/gallery", roles: ["student", "parent", "teacher", "admin"], color: COLORS.ochre },
    { key: "lms", icon: "library-outline", label: t("lms"), route: "/lms", roles: ["student", "parent", "teacher"], color: COLORS.primary },
    
    //  FIX: 'parent' hataya taaki parent ke dashboard par Leaves na dikhe
    { key: "leaves", icon: "mail-outline", label: t("leaves"), route: "/leaves", roles: ["student", "teacher", "admin"], color: COLORS.error },
    
    { key: "ta", icon: "checkmark-done-outline", label: t("mark_attendance"), route: "/teacher-attendance", roles: ["teacher"], color: COLORS.primary },
    { key: "th", icon: "cloud-upload-outline", label: t("post_homework"), route: "/teacher-homework", roles: ["teacher"], color: COLORS.secondary },
    { key: "bcast", icon: "megaphone-outline", label: t("admin_broadcast"), route: "/admin-broadcasts", roles: ["teacher", "admin"], color: COLORS.terracotta },
    { key: "adminfees", icon: "cash-outline", label: "Fees Overview", route: "/admin-fees", roles: ["teacher", "admin"], color: COLORS.success },

    //  NEW FACULTY BLOCK: Accessible by EVERYONE, route maps perfectly to faculty.tsx
    { key: "faculty", icon: "people-outline", label: "Our Faculty", route: "/faculty", roles: ["student", "parent", "teacher", "admin"], color: "#1E3A8A" },
  ];

  const filtered = items.filter((i) => i.roles.includes(user?.role ?? ""));

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.roleBadge}>
              <Text style={styles.roleText}>{user?.role.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("language")}</Text>
          <View style={styles.langRow}>
            <TouchableOpacity
              style={[styles.langBtn, lang === "en" && styles.langActive]}
              onPress={() => setLang("en")}
            >
              <Text style={[styles.langText, lang === "en" && styles.langTextActive]}>English</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, lang === "hi" && styles.langActive]}
              onPress={() => setLang("hi")}
            >
              <Text style={[styles.langText, lang === "hi" && styles.langTextActive]}>हिन्दी</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.grid}>
            {filtered.map((it) => (
              <TouchableOpacity
                key={it.key}
                style={styles.tile}
                onPress={() => router.push(it.route as any)}
              >
                <View style={[styles.tileIcon, { backgroundColor: it.color + "22" }]}>
                  <Ionicons name={it.icon} size={22} color={it.color} />
                </View>
                <Text style={styles.tileLabel} numberOfLines={2}>{it.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
          <Text style={styles.logoutText}>{t("logout")}</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Vidya Sahaayak v1.0 • Made with care</Text>
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: SPACING.lg, gap: SPACING.lg },
  profile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 18, fontWeight: "800", color: COLORS.textMain },
  email: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  roleBadge: { marginTop: 8, alignSelf: "flex-start", backgroundColor: COLORS.chipBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  roleText: { color: COLORS.primary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 13, color: COLORS.textMuted, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  langRow: { flexDirection: "row", gap: 10 },
  langBtn: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: COLORS.surface,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
  },
  langActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  langText: { fontSize: 14, fontWeight: "700", color: COLORS.textMain },
  langTextActive: { color: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  tile: {
    width: "48%",
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 10,
  },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tileLabel: { fontSize: 14, fontWeight: "700", color: COLORS.textMain },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FDECEC",
    padding: 14,
    borderRadius: RADII.lg,
  },
  logoutText: { color: COLORS.error, fontSize: 15, fontWeight: "700" },
  footer: { textAlign: "center", color: COLORS.textMuted, fontSize: 11, marginTop: 8 },
});