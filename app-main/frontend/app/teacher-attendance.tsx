import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/AuthContext";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";
import { Ionicons } from "@expo/vector-icons";

//  JODIYA: "holiday" status type list mein
type Status = "present" | "absent" | "late" | "holiday" | "none";

const AVAILABLE_CLASSES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const getDaysInMonth = (monthStr: string) => {
  const [year, month] = monthStr.split("-").map(Number);
  return new Date(year, month, 0).getDate();
};

export default function TeacherAttendance() {
  const { user } = useAuth();
  const { t } = useLang();
  
  const defaultClass = user?.class_id ? String(user.class_id).replace("cls_", "") : "10";
  const [activeClass, setActiveClass] = useState(defaultClass);
  
  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonth);

  const [students, setStudents] = useState<any[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, Status>>>({});
  
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const totalDays = getDaysInMonth(selectedMonth);
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  const loadMonthData = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.get(`/attendance/class/${activeClass}?date=${selectedMonth}-01`);
      setStudents(list || []);
      
      const initialMatrix: Record<string, Record<string, Status>> = {};
      
      list.forEach((s: any) => {
        initialMatrix[s.student_id] = {};
        daysArray.forEach((day) => {
          const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
          if (s.monthly_records && s.monthly_records[dateStr]) {
            initialMatrix[s.student_id][dateStr] = s.monthly_records[dateStr];
          } else {
            initialMatrix[s.student_id][dateStr] = "none";
          }
        });
      });
      
      setMatrix(initialMatrix);
    } catch (err) {
      setStudents([]);
      setMatrix({});
    } finally {
      setLoading(false);
    }
  }, [activeClass, selectedMonth, totalDays]);

  useEffect(() => { loadMonthData(); }, [loadMonthData]);

  //  FIX: Click karne par ab Holiday (H) bhi toggle list mein aayega
  const updateStatus = (studentId: string, day: number, currentStatus: Status) => {
    const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
    const nextStatusMap: Record<Status, Status> = {
      none: "present",
      present: "absent",
      absent: "late",
      late: "holiday",  // Late ke baad Holiday aayega
      holiday: "none",  // Holiday ke baad wapas empty loop container
    };
    const nextStatus = nextStatusMap[currentStatus];

    setMatrix((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [dateStr]: nextStatus,
      },
    }));
  };

  //  DYNAMIC NEW: Ek poore dynamic date ko direct master 'Holiday' set karne ka feature
  const markFullDayAsHoliday = (day: number) => {
    const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
    setMatrix((prev) => {
      const updated = { ...prev };
      students.forEach((s) => {
        if (!updated[s.student_id]) updated[s.student_id] = {};
        updated[s.student_id][dateStr] = "holiday";
      });
      return updated;
    });
  };

  async function saveFullSheet() {
    setSaving(true);
    try {
      for (let day = 1; day <= totalDays; day++) {
        const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
        const dayEntries = Object.entries(matrix).map(([student_id, dateMap]) => ({
          student_id,
          status: dateMap[dateStr] === "none" ? "present" : dateMap[dateStr],
        }));

        await api.post("/attendance/mark", {
          class_id: activeClass,
          date: dateStr,
          entries: dayEntries,
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // Error boundary setup mapping fallback
    } finally { setSaving(false); }
  }

  // Live analytics block parameters metrics counters
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLate = 0;
  let totalHolidays = 0; // ⚡ New holiday calculations counter jodiya

  Object.values(matrix).forEach((dateMap) => {
    Object.values(dateMap).forEach((status) => {
      if (status === "present") totalPresent++;
      if (status === "absent") totalAbsent++;
      if (status === "late") totalLate++;
      if (status === "holiday") totalHolidays++;
    });
  });

  return (
    <ScreenHeader title={t("mark_attendance")} subtitle={`Class ${activeClass} • Monthly Register View`} showBack>
      
      <View style={styles.datePickerContainer}>
        <View style={styles.dateFlex}>
          <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
          <Text style={styles.dateLabel}>Select Attendance Month:</Text>
        </View>
        
        {Platform.OS === "web" ? (
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: `1px solid ${COLORS.border}`,
              backgroundColor: COLORS.surface,
              color: COLORS.textMain,
              fontWeight: "bold",
              fontSize: "14px",
              outline: "none"
            }}
          />
        ) : (
          <TouchableOpacity style={styles.dateButton} onPress={() => {
              const m = prompt("Enter Month (YYYY-MM):", selectedMonth);
              if (m && /^\d{4}-\d{2}$/.test(m)) setSelectedMonth(m);
            }}>
            <Text style={styles.dateButtonText}>{selectedMonth}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classSelectorRow} contentContainerStyle={styles.classSelectorPadding}>
        {AVAILABLE_CLASSES.map((c) => (
          <TouchableOpacity key={c} style={[styles.classChip, activeClass === c && styles.classChipActive]} onPress={() => setActiveClass(c)}>
            <Text style={[styles.classChipText, activeClass === c && styles.classChipTextActive]}>Class {c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Analytics Total Score Counters Layout Panel */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryBox, { backgroundColor: "#E6F7EF" }]}>
          <Text style={[styles.summaryVal, { color: COLORS.success }]}>{totalPresent}</Text>
          <Text style={styles.summaryLbl}>Present</Text>
        </View>
        <View style={[styles.summaryBox, { backgroundColor: "#FDECEC" }]}>
          <Text style={[styles.summaryVal, { color: COLORS.error }]}>{totalAbsent}</Text>
          <Text style={styles.summaryLbl}>Absent</Text>
        </View>
        <View style={[styles.summaryBox, { backgroundColor: "#FEF3E2" }]}>
          <Text style={[styles.summaryVal, { color: COLORS.warning }]}>{totalLate}</Text>
          <Text style={styles.summaryLbl}>Late</Text>
        </View>
        {/* ⚡ NEW SUMMARY BOX FOR HOLIDAYS */}
        <View style={[styles.summaryBox, { backgroundColor: "#F0F0F0" }]}>
          <Text style={[styles.summaryVal, { color: "#666" }]}>{totalHolidays}</Text>
          <Text style={styles.summaryLbl}>Holidays</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView style={{ marginTop: 15 }} contentContainerStyle={{ paddingHorizontal: SPACING.lg }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View style={styles.registerTable}>
              
              {/* Header Row */}
              <View style={styles.tableRowHeader}>
                <Text style={[styles.cellHeader, { width: 140, textAlign: "left" }]}>Student Name</Text>
                {daysArray.map((day) => (
                  <TouchableOpacity key={day} onPress={() => {
                    const confirmHoliday = window.confirm(`Mark all students as Holiday for Day ${day}?`);
                    if (confirmHoliday) markFullDayAsHoliday(day);
                  }}>
                    <Text style={styles.cellDayHeader}>{String(day).padStart(2, "0")}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Data Rows */}
              {students.map((s) => (
                <View key={s.student_id} style={styles.tableRow}>
                  <Text style={[styles.studentNameCell, { width: 140 }]} numberOfLines={1}>{s.name}</Text>
                  
                  {daysArray.map((day) => {
                    const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
                    const currentStatus = matrix[s.student_id]?.[dateStr] || "none";
                    
                    return (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.actionGridCell,
                          currentStatus === "present" && { backgroundColor: COLORS.success },
                          currentStatus === "absent" && { backgroundColor: COLORS.error },
                          currentStatus === "late" && { backgroundColor: COLORS.warning },
                          currentStatus === "holiday" && { backgroundColor: "#A0A0A0" }, // ⚡ Grey color format for holiday cell grids
                        ]}
                        onPress={() => updateStatus(s.student_id, day, currentStatus)}
                      >
                        <Text style={[styles.actionGridText, currentStatus !== "none" && { color: "#fff" }]}>
                          {currentStatus === "none" ? "-" : currentStatus === "holiday" ? "H" : currentStatus[0].toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>

          {students.length === 0 && (
            <Text style={styles.emptyText}>No students registered under Class {activeClass} yet.</Text>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      <View style={styles.footer}>
        {saved && (
          <View style={styles.savedBanner}>
            <Ionicons name="checkmark-circle" size={16} color={COLORS.success} />
            <Text style={styles.savedText}>Monthly Register Sheet Saved Successfully!</Text>
          </View>
        )}
        <TouchableOpacity style={styles.submitBtn} onPress={saveFullSheet} disabled={saving || students.length === 0}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Save Full Month Register</Text>}
        </TouchableOpacity>
      </View>
    </ScreenHeader>
  );
}

const styles = StyleSheet.create({
  datePickerContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingVertical: 12, backgroundColor: COLORS.surface },
  dateFlex: { flexDirection: "row", alignItems: "center", gap: 6 },
  dateLabel: { fontSize: 13, fontWeight: "700", color: COLORS.textMain },
  dateButton: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, backgroundColor: COLORS.chipBg },
  dateButtonText: { fontSize: 14, fontWeight: "bold", color: COLORS.primary },
  classSelectorRow: { flexGrow: 0, maxHeight: 42, marginTop: 6, marginBottom: 4 },
  classSelectorPadding: { gap: 8, paddingHorizontal: SPACING.lg },
  classChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  classChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  classChipText: { fontSize: 13, fontWeight: "700", color: COLORS.textMain },
  classChipTextActive: { color: "#fff" },
  summaryRow: { flexDirection: "row", gap: 8, paddingHorizontal: SPACING.lg, paddingTop: 8 },
  summaryBox: { flex: 1, padding: 10, borderRadius: RADII.lg, alignItems: "center" },
  summaryVal: { fontSize: 18, fontWeight: "800" },
  summaryLbl: { fontSize: 9, color: COLORS.textMuted, marginTop: 2, fontWeight: "600", textAlign: "center" },
  registerTable: { flexDirection: "column", borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.md, backgroundColor: COLORS.surface, overflow: "hidden" },
  tableRowHeader: { flexDirection: "row", backgroundColor: COLORS.chipBg, alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  cellHeader: { fontWeight: "800", color: COLORS.textMain, fontSize: 13, paddingHorizontal: 10 },
  cellDayHeader: { width: 32, textAlign: "center", fontWeight: "800", fontSize: 12, color: COLORS.textMain, borderLeftWidth: 1, borderLeftColor: COLORS.border + "33" },
  tableRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: COLORS.border + "44", paddingVertical: 6 },
  studentNameCell: { fontWeight: "700", color: COLORS.textMain, fontSize: 13, paddingHorizontal: 10 },
  actionGridCell: { width: 32, height: 32, justifyContent: "center", alignItems: "center", borderLeftWidth: 1, borderLeftColor: COLORS.border + "33", marginHorizontal: 1, borderRadius: 4 },
  actionGridText: { fontWeight: "800", fontSize: 13, color: COLORS.textMuted },
  emptyText: { textAlign: "center", color: COLORS.textMuted, marginTop: 40, fontSize: 14 },
  footer: { padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface, gap: 10 },
  savedBanner: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#E6F7EF", padding: 10, borderRadius: RADII.md },
  savedText: { color: COLORS.success, fontWeight: "700" },
  submitBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADII.lg, alignItems: "center" },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});