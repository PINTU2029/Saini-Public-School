import React, { useCallback, useEffect, useState } from "react";
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/AuthContext";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";
import Badge from "@/src/components/Badge";

type Tab = "homework" | "notices";

export default function DiaryScreen() {
  const { user } = useAuth();
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>("homework");
  const [homework, setHomework] = useState<any[]>([]);
  const [notices, setNotices] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const [hw, nts] = await Promise.all([api.get("/homework"), api.get("/notices")]);
      setHomework(hw);
      setNotices(nts);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t("diary")}</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "homework" && styles.tabActive]}
          onPress={() => setTab("homework")}
        >
          <Ionicons name="book" size={16} color={tab === "homework" ? "#fff" : COLORS.textMain} />
          <Text style={[styles.tabText, tab === "homework" && styles.tabTextActive]}>{t("homework")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "notices" && styles.tabActive]}
          onPress={() => setTab("notices")}
        >
          <Ionicons name="megaphone" size={16} color={tab === "notices" ? "#fff" : COLORS.textMain} />
          <Text style={[styles.tabText, tab === "notices" && styles.tabTextActive]}>{t("notices")}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {tab === "homework" && (
          <>
            {homework.length === 0 && <Text style={styles.empty}>{t("no_data")}</Text>}
            {homework.map((h) => {
              const isOpen = !!expanded[h.homework_id];
              return (
                <TouchableOpacity
                  key={h.homework_id}
                  activeOpacity={0.9}
                  style={styles.card}
                  onPress={() => setExpanded((e) => ({ ...e, [h.homework_id]: !e[h.homework_id] }))}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.iconWrap}>
                      <Ionicons name="document-text" size={20} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{h.title}</Text>
                      <Text style={styles.cardMeta}>{h.subject} • Due {h.due_date}</Text>
                    </View>
                    <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={20} color={COLORS.textMuted} />
                  </View>
                  {isOpen && (
                    <View style={{ marginTop: 10 }}>
                      <Text style={styles.cardBody}>{h.description}</Text>
                      <Text style={styles.postedBy}>Posted by {h.posted_by_name}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </>
        )}

        {tab === "notices" && (
          <>
            {notices.length === 0 && <Text style={styles.empty}>{t("no_data")}</Text>}
            {notices.map((n) => (
              <View key={n.notice_id} style={styles.card}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Badge
                    label={n.category.toUpperCase()}
                    variant={n.category === "urgent" ? "error" : n.category === "holiday" ? "info" : n.category === "event" ? "warning" : "default"}
                    small
                  />
                  <Text style={styles.cardMeta}>{new Date(n.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.cardTitle}>{n.title}</Text>
                <Text style={styles.cardBody}>{n.body}</Text>
                <Text style={styles.postedBy}>— {n.posted_by_name}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: 26, fontWeight: "800", color: COLORS.textMain, letterSpacing: -0.5 },
  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: "700", color: COLORS.textMain },
  tabTextActive: { color: "#fff" },
  scroll: { padding: SPACING.lg, gap: 12 },
  card: {
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 6,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.chipBg,
    alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontSize: 15, fontWeight: "800", color: COLORS.textMain, marginTop: 4 },
  cardMeta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  cardBody: { fontSize: 14, color: COLORS.textMain, lineHeight: 20, marginTop: 4 },
  postedBy: { fontSize: 12, color: COLORS.textMuted, marginTop: 8, fontStyle: "italic" },
  empty: { textAlign: "center", color: COLORS.textMuted, marginTop: 40, fontSize: 14 },
});