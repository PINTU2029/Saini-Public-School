import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import ScreenHeader from "@/src/components/ScreenHeader";
import Badge from "@/src/components/Badge";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/AuthContext";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";

//  Dynamic Classes Array Framework (1 to 12)
const STACK_CLASSES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export default function ReportCardScreen() {
  const { user } = useAuth();
  const { t } = useLang();
  
  //  Default class fallback setup
  const defaultClass = user?.class_id ? String(user.class_id).replace("cls_", "") : "10";
  const [activeClass, setActiveClass] = useState(defaultClass);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      //FIX: Ab koi bhi user (Student, Parent, Teacher) direct classwise open check kar sakta hai
      const r = await api.get(`/report-cards/view?class_id=${activeClass}`);
      setReports(r || []);
    } catch (err) {
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [activeClass]);

  useEffect(() => { load(); }, [load]);

  // Safe percentage evaluator tool calculation block
  const calculateSubjectPct = (marks: any, maxMarks: any) => {
    const m = parseFloat(marks) || 0;
    const max = parseFloat(maxMarks) || 100;
    return max > 0 ? (m / max) * 100 : 0;
  };

  return (
    <ScreenHeader title={t("report_card")} showBack>
      
      {/*  OPEN ACCESS: Class Selector Bar ab sabhi users ko dikhega */}
      <View style={styles.selectorContainer}>
        <Text style={styles.sectionLabel}>Select Class View</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.classSelectorPadding}
        >
          {STACK_CLASSES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.classChip, activeClass === c && styles.classChipActive]}
              onPress={() => setActiveClass(c)}
            >
              <Text style={[styles.classChipText, activeClass === c && styles.classChipTextActive]}>
                Class {c}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {reports.length === 0 && <Text style={styles.empty}>{t("no_data")}</Text>}
          {reports.map((r, idx) => (
            <View key={r.report_id || idx} style={styles.card}>
              <View style={styles.head}>
                <View style={{ flex: 1 }}>
                  {/* ⚡ DYNAMIC: Renders Student Name & Details for Everyone */}
                  <Text style={styles.studentNameText}>
                    {r.student_name || "Unknown Student"}
                  </Text>
                  <Text style={styles.studentIdLabel}>Student ID: {r.student_id}</Text>
                  <Text style={styles.term}>{r.term}</Text>
                  <Text style={styles.overall}>{r.percentage}% overall</Text>
                </View>
                <View style={styles.gradeBadge}>
                  <Text style={styles.gradeText}>{gradeFromPct(parseFloat(r.percentage) || 0)}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {r.subjects?.map((s: any, i: number) => {
                const subjectPct = calculateSubjectPct(s.marks, s.max_marks);
                return (
                  <View key={i} style={styles.subRow}>
                    <Text style={styles.subName}>{s.name}</Text>
                    <View style={styles.marksRow}>
                      <Text style={styles.marks}>{s.marks}/{s.max_marks}</Text>
                      <Badge label={s.grade || "N/A"} variant={pctColor(subjectPct)} small />
                    </View>
                  </View>
                );
              })}

              <View style={styles.divider} />
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{r.total}/{r.max_total}</Text>
              </View>

              {r.remarks ? (
                <View style={styles.remarks}>
                  <Text style={styles.remarksLabel}>Teacher&apos;s Remarks</Text>
                  <Text style={styles.remarksText}>{r.remarks}</Text>
                </View>
              ) : null}
            </View>
          ))}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </ScreenHeader>
  );
}

function gradeFromPct(p: number) {
  if (p >= 90) return "A+";
  if (p >= 80) return "A";
  if (p >= 70) return "B+";
  if (p >= 60) return "B";
  if (p >= 40) return "C";
  return "D";
}

function pctColor(p: number): "success" | "warning" | "error" | "default" {
  if (p >= 75) return "success";
  if (p >= 50) return "warning";
  return "error";
}

const styles = StyleSheet.create({
  selectorContainer: { marginBottom: 4 },
  sectionLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "700", paddingHorizontal: SPACING.lg, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 },
  classSelectorPadding: { gap: 8, paddingHorizontal: SPACING.lg, paddingBottom: 6 },
  classChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  classChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  classChipText: { fontSize: 13, fontWeight: "700", color: COLORS.textMain },
  classChipTextActive: { color: "#fff" },
  scroll: { padding: SPACING.lg, gap: 14 },
  empty: { textAlign: "center", color: COLORS.textMuted, marginTop: 40 },
  card: {
    backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: RADII.xl,
    borderWidth: 1, borderColor: COLORS.border, gap: 12,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  studentNameText: { fontSize: 16, fontWeight: "800", color: COLORS.textMain, marginBottom: 2 },
  studentIdLabel: { fontSize: 11, fontWeight: "700", color: COLORS.textMuted, marginBottom: 4, textTransform: "uppercase" },
  term: { fontSize: 14, fontWeight: "700", color: COLORS.textMain },
  overall: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },
  gradeBadge: {
    width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
  gradeText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  divider: { height: 1, backgroundColor: COLORS.border },
  subRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 4 },
  subName: { fontSize: 14, color: COLORS.textMain, fontWeight: "600", flex: 1 },
  marksRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  marks: { fontSize: 14, fontWeight: "700", color: COLORS.textMain },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalLabel: { fontSize: 15, fontWeight: "800", color: COLORS.textMain },
  totalValue: { fontSize: 18, fontWeight: "800", color: COLORS.primary },
  remarks: { backgroundColor: COLORS.bg, padding: 12, borderRadius: RADII.md, borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  remarksLabel: { fontSize: 11, color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, fontWeight: "700" },
  remarksText: { fontSize: 13, color: COLORS.textMain, marginTop: 4, lineHeight: 18 },
});