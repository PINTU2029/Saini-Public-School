import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";
import { Ionicons } from "@expo/vector-icons";

const ALL_CLASSES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export default function AdminCreateReportScreen() {
  const [studentId, setStudentId] = useState("");
  const [studentName, setStudentName] = useState(""); //  State for Student Name
  const [targetClass, setTargetClass] = useState("10"); //  State for Manual Class
  const [term, setTerm] = useState("Term 1");
  const [remarks, setRemarks] = useState("");
  const [subjects, setSubjects] = useState([{ name: "", marks: 0, max_marks: 100, grade: "A" }]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const addSubjectRow = () => setSubjects([...subjects, { name: "", marks: 0, max_marks: 100, grade: "A" }]);
  const removeSubjectRow = (index: number) => {
    const next = [...subjects];
    next.splice(index, 1);
    setSubjects(next);
  };

  const updateSubject = (index: number, field: string, value: any) => {
    const next = [...subjects] as any;
    next[index][field] = field === "marks" || field === "max_marks" ? parseFloat(value) || 0 : value;
    setSubjects(next);
  };

  const submitReport = async () => {
    if (!studentId.trim() || !studentName.trim()) {
      Alert.alert("Error", "Please enter Student ID and Student Name");
      return;
    }

    setLoading(true);
    try {
      let rawId = studentId.trim();
      const cleanStudentId = rawId.startsWith("std_") ? rawId : `std_${rawId}`;

      const payload = {
        student_id: cleanStudentId,
        student_name: studentName.trim(),
        class_id: targetClass,
        term,
        subjects,
        remarks,
      };

      await api.post("/report-cards", payload);
      setSuccess(true);
      setStudentId("");
      setStudentName("");
      setRemarks("");
      setSubjects([{ name: "", marks: 0, max_marks: 100, grade: "A" }]);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      Alert.alert("Error", "Failed to publish report card");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenHeader title="Create Report Card" showBack>
      <ScrollView contentContainerStyle={styles.scroll}>
        {success && <View style={styles.successBanner}><Text style={styles.successText}>Published Successfully!</Text></View>}

        <View style={styles.card}>
          <Text style={styles.label}>Student ID</Text>
          <TextInput style={styles.input} placeholder="e.g. 1025" value={studentId} onChangeText={setStudentId} />

          <Text style={styles.label}>Student Full Name</Text>
          <TextInput style={styles.input} placeholder="e.g. Rahul Kumar" value={studentName} onChangeText={setStudentName} />

          <Text style={styles.label}>Select Class Assignment</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
            {ALL_CLASSES.map((c) => (
              <TouchableOpacity key={c} style={[styles.chip, targetClass === c && styles.chipActive]} onPress={() => setTargetClass(c)}>
                <Text style={[styles.chipText, targetClass === c && { color: "#fff" }]}>Class {c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Exam Term</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {["Term 1", "Term 2", "Finals"].map((trm) => (
              <TouchableOpacity key={trm} style={[styles.termBtn, term === trm && styles.termBtnActive]} onPress={() => setTerm(trm)}>
                <Text style={[styles.termBtnText, term === trm && { color: "#fff" }]}>{trm}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Subjects Entry Rows */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={styles.sectionTitle}>Subjects & Marks</Text>
          <TouchableOpacity style={{ flexDirection: "row", alignItems: "center", gap: 4 }} onPress={addSubjectRow}>
            <Text style={{ color: COLORS.primary, fontWeight: "700" }}>+ Add Subject</Text>
          </TouchableOpacity>
        </View>

        {subjects.map((sub, idx) => (
          <View key={idx} style={styles.subjectCard}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, color: COLORS.textMuted }}>Subject #{idx + 1}</Text>
              {subjects.length > 1 && (
                <TouchableOpacity onPress={() => removeSubjectRow(idx)}>
                  <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                </TouchableOpacity>
              )}
            </View>
            <TextInput style={styles.input} placeholder="Subject Name" value={sub.name} onChangeText={(v) => updateSubject(idx, "name", v)} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Obtained" keyboardType="numeric" onChangeText={(v) => updateSubject(idx, "marks", v)} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Max Marks" keyboardType="numeric" onChangeText={(v) => updateSubject(idx, "max_marks", v)} />
              <TextInput style={[styles.input, { flex: 0.8 }]} placeholder="Grade" value={sub.grade} onChangeText={(v) => updateSubject(idx, "grade", v)} />
            </View>
          </View>
        ))}

        <TextInput style={[styles.input, { height: 60 }]} placeholder="Remarks..." value={remarks} onChangeText={setRemarks} multiline />

        <TouchableOpacity style={styles.submitBtn} onPress={submitReport} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "800" }}>Publish Report Card</Text>}
        </TouchableOpacity>
      </ScrollView>
    </ScreenHeader>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, gap: 14 },
  successBanner: { backgroundColor: "#E6F7EF", padding: 12, borderRadius: RADII.md, alignItems: "center" },
  successText: { color: COLORS.success, fontWeight: "700" },
  card: { backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: RADII.xl, borderWidth: 1, borderColor: COLORS.border, gap: 10 },
  subjectCard: { backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADII.lg, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  label: { fontSize: 13, fontWeight: "700", color: COLORS.textMain, marginTop: 4 },
  input: { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.md, paddingHorizontal: 12, paddingVertical: 10, color: COLORS.textMain },
  termBtn: { flex: 1, paddingVertical: 10, borderRadius: RADII.md, backgroundColor: COLORS.bg, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  termBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  termBtnText: { fontSize: 13, fontWeight: "700", color: COLORS.textMain },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: "700", color: COLORS.textMain },
  sectionTitle: { fontSize: 12, color: COLORS.textMuted, fontWeight: "800", textTransform: "uppercase" },
  submitBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADII.lg, alignItems: "center" }
});