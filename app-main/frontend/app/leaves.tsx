import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from "react-native";
import ScreenHeader from "@/src/components/ScreenHeader";
import Badge from "@/src/components/Badge";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/AuthContext";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";
import { Ionicons } from "@expo/vector-icons";

export default function LeavesScreen() {
  const { user } = useAuth();
  const { t } = useLang();
  const [leaves, setLeaves] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canRequest = user?.role === "student" || user?.role === "parent";
  const canAct = user?.role === "teacher" || user?.role === "admin";

  const load = useCallback(async () => {
    const q = canRequest && user?.role === "parent" && user.child_ids?.length
      ? `?student_id=${user.child_ids[0]}`
      : user?.role === "student"
        ? `?student_id=${user.user_id}`
        : "";
    const r = await api.get(`/leaves${q}`);
    setLeaves(r);
  }, [user, canRequest]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!from || !to || !reason) return;
    setSubmitting(true);
    try {
      const studentId = user?.role === "student" ? user.user_id : user?.child_ids?.[0];
      if (!studentId) return;
      await api.post("/leaves", { student_id: studentId, from_date: from, to_date: to, reason });
      setShowForm(false);
      setFrom(""); setTo(""); setReason("");
      await load();
    } finally { setSubmitting(false); }
  }

  async function act(leave_id: string, action: "approve" | "reject") {
    await api.post("/leaves/action", { leave_id, action });
    await load();
  }

  return (
    <ScreenHeader title={t("leaves")} showBack>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {canRequest && !showForm && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(true)}>
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text style={styles.addText}>Request New Leave</Text>
            </TouchableOpacity>
          )}

          {showForm && (
            <View style={styles.form}>
              <Text style={styles.formTitle}>New Leave Request</Text>
              <Text style={styles.label}>From Date (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={from} onChangeText={setFrom} placeholder="2026-03-10" placeholderTextColor={COLORS.textMuted} />
              <Text style={styles.label}>To Date (YYYY-MM-DD)</Text>
              <TextInput style={styles.input} value={to} onChangeText={setTo} placeholder="2026-03-12" placeholderTextColor={COLORS.textMuted} />
              <Text style={styles.label}>Reason</Text>
              <TextInput style={[styles.input, { height: 80 }]} value={reason} onChangeText={setReason} placeholder="Reason for leave" placeholderTextColor={COLORS.textMuted} multiline />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowForm(false)}>
                  <Text style={styles.cancelText}>{t("cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={submit} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t("submit")}</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {leaves.length === 0 && !showForm && <Text style={styles.empty}>{t("no_data")}</Text>}

          {leaves.map((l) => (
            <View key={l.leave_id} style={styles.card}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.dates}>{l.from_date} → {l.to_date}</Text>
                <Badge
                  label={l.status.toUpperCase()}
                  variant={l.status === "approved" ? "success" : l.status === "rejected" ? "error" : "warning"}
                  small
                />
              </View>
              <Text style={styles.reason}>{l.reason}</Text>
              <Text style={styles.by}>Requested by {l.requested_by_name}</Text>
              {canAct && l.status === "pending" && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => act(l.leave_id, "approve")}>
                    <Ionicons name="checkmark" size={16} color="#fff" />
                    <Text style={styles.approveText}>{t("approve")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => act(l.leave_id, "reject")}>
                    <Ionicons name="close" size={16} color="#fff" />
                    <Text style={styles.rejectText}>{t("reject")}</Text>
                  </TouchableOpacity>
                </View>
              )}
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
  addBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.primary, padding: 14, borderRadius: RADII.lg,
  },
  addText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  form: {
    backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: RADII.xl,
    borderWidth: 1, borderColor: COLORS.border, gap: 4,
  },
  formTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textMain, marginBottom: 6 },
  label: { fontSize: 12, color: COLORS.textMuted, marginTop: 8, fontWeight: "700" },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.md,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: COLORS.textMain, backgroundColor: "#FAFAF9",
    textAlignVertical: "top",
  },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: RADII.lg, backgroundColor: COLORS.bg, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  cancelText: { fontWeight: "700", color: COLORS.textMain },
  submitBtn: { flex: 1, paddingVertical: 12, borderRadius: RADII.lg, backgroundColor: COLORS.primary, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "700" },
  empty: { textAlign: "center", color: COLORS.textMuted, marginTop: 40 },
  card: {
    backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: RADII.lg,
    borderWidth: 1, borderColor: COLORS.border, gap: 6,
  },
  dates: { fontSize: 14, fontWeight: "800", color: COLORS.textMain },
  reason: { fontSize: 13, color: COLORS.textMain, marginTop: 4 },
  by: { fontSize: 11, color: COLORS.textMuted, fontStyle: "italic" },
  approveBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: RADII.md, backgroundColor: COLORS.success },
  approveText: { color: "#fff", fontWeight: "700" },
  rejectBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: RADII.md, backgroundColor: COLORS.error },
  rejectText: { color: "#fff", fontWeight: "700" },
});