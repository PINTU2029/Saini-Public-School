// @ts-nocheck
import React, { useCallback, useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from "react-native";
import ScreenHeader from "@/src/components/ScreenHeader";
import Badge from "@/src/components/Badge";
import { api } from "@/src/lib/api";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";
import { Ionicons } from "@expo/vector-icons";

const CATEGORIES = [
  { key: "general", label: "General", color: COLORS.primary },
  { key: "urgent", label: "Urgent", color: COLORS.error },
  { key: "holiday", label: "Holiday", color: "#2E6FDB" },
  { key: "event", label: "Event", color: COLORS.warning },
];

const TARGETS = ["all", "parent", "teacher", "student"];

export default function AdminBroadcasts() {
  const { t } = useLang();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("general");
  const [target, setTarget] = useState("all");
  const [saving, setSaving] = useState(false);
  const [posted, setPosted] = useState(false);
  const [notices, setNotices] = useState<any[]>([]);

  const load = useCallback(async () => {
    const r = await api.get("/notices");
    setNotices(r);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!title || !body) return;
    setSaving(true);
    try {
      await api.post("/notices", { title, body, category, target_role: target });
      setPosted(true);
      setTitle(""); setBody("");
      await load();
      setTimeout(() => setPosted(false), 3000);
    } finally { setSaving(false); }
  }

  return (
    <ScreenHeader title={t("admin_broadcast")} showBack>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.form}>
            <Text style={styles.formTitle}>Send New Broadcast</Text>

            {posted && (
              <View style={styles.banner}>
                <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
                <Text style={styles.bannerText}>Notice sent!</Text>
              </View>
            )}

            <Text style={styles.label}>Category</Text>
            <View style={styles.catRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.catChip, category === c.key && { backgroundColor: c.color, borderColor: c.color }]}
                  onPress={() => setCategory(c.key)}
                >
                  <Text style={[styles.catText, category === c.key && { color: "#fff" }]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Send To</Text>
            <View style={styles.catRow}>
              {TARGETS.map((tg) => (
                <TouchableOpacity
                  key={tg}
                  style={[styles.catChip, target === tg && styles.catActive]}
                  onPress={() => setTarget(tg)}
                >
                  <Text style={[styles.catText, target === tg && { color: "#fff" }]}>{tg.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle}
              placeholder="Notice title" placeholderTextColor={COLORS.textMuted} />

            <Text style={styles.label}>Message</Text>
            <TextInput style={[styles.input, { height: 100 }]} value={body} onChangeText={setBody}
              placeholder="Write your notice..." placeholderTextColor={COLORS.textMuted} multiline />

            <TouchableOpacity
              style={[styles.submitBtn, (!title || !body) && { opacity: 0.5 }]}
              onPress={submit}
              disabled={saving || !title || !body}
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Ionicons name="send" size={18} color="#fff" />
                  <Text style={styles.submitText}>Send Broadcast</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.h}>Recent Broadcasts</Text>
          {notices.slice(0, 10).map((n) => (
            <View key={n.notice_id} style={styles.notice}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Badge label={n.category.toUpperCase()} variant={n.category === "urgent" ? "error" : n.category === "holiday" ? "info" : n.category === "event" ? "warning" : "default"} small />
                <Text style={styles.meta}>To: {n.target_role.toUpperCase()}</Text>
              </View>
              <Text style={styles.noticeTitle}>{n.title}</Text>
              <Text style={styles.noticeBody} numberOfLines={2}>{n.body}</Text>
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenHeader>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, gap: 12 },
  form: { backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: RADII.xl, borderWidth: 1, borderColor: COLORS.border, gap: 4 },
  formTitle: { fontSize: 17, fontWeight: "800", color: COLORS.textMain, marginBottom: 6 },
  banner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#E6F7EF", padding: 10, borderRadius: RADII.md, marginBottom: 6 },
  bannerText: { color: COLORS.success, fontWeight: "700" },
  label: { fontSize: 12, color: COLORS.textMuted, fontWeight: "700", marginTop: 10, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 },
  catRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  catActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { fontSize: 12, fontWeight: "700", color: COLORS.textMain },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.md,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: COLORS.textMain, backgroundColor: "#FAFAF9",
    textAlignVertical: "top",
  },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 16, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADII.lg,
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  h: { fontSize: 13, fontWeight: "800", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginTop: 16 },
  notice: { backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: RADII.lg, borderWidth: 1, borderColor: COLORS.border, gap: 6 },
  noticeTitle: { fontSize: 14, fontWeight: "800", color: COLORS.textMain, marginTop: 4 },
  noticeBody: { fontSize: 13, color: COLORS.textMuted, lineHeight: 18 },
  meta: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
});