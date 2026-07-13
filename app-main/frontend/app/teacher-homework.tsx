import React, { useState } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert
} from "react-native";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/AuthContext";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";
import { Ionicons } from "@expo/vector-icons";

const SUBJECTS = ["Mathematics", "Science", "English", "Hindi", "Social Studies"];
//  Dynamic class mapping lists array framework
const CLASSES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export default function TeacherHomework() {
  const { user } = useAuth();
  const { t } = useLang();
  
  const [subject, setSubject] = useState(user?.subject ?? SUBJECTS[0]);
  //  FIX: Fallback cleaner to avoid hardcoded static strings like "cls_10a"
  const [selectedClass, setSelectedClass] = useState(user?.class_id ? String(user.class_id).replace("cls_", "") : "10");
  
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]); // Default current date placeholder
  const [saving, setSaving] = useState(false);
  const [posted, setPosted] = useState(false);

  async function submit() {
    if (!title || !description || !dueDate || !selectedClass) {
      Alert.alert("Missing Fields", "Please populate all structural mandatory text keys.");
      return;
    }
    
    setSaving(true);
    try {
      //  SENDING SANITIZED DATA: Transmits absolute values like "10" directly 
      await api.post("/homework", { 
        class_id: selectedClass.trim(), 
        subject, 
        title: title.trim(), 
        description: description.trim(), 
        due_date: dueDate.trim() 
      });
      
      setPosted(true);
      setTitle(""); 
      setDescription(""); 
      
      setTimeout(() => setPosted(false), 3000);
    } catch (e: any) {
      Alert.alert("Submission Failed", e?.message || "Could not push homework log.");
    } finally { 
      setSaving(false); 
    }
  }

  return (
    <ScreenHeader title={t("post_homework")} showBack>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {posted && (
            <View style={styles.banner}>
              <Ionicons name="checkmark-circle" size={18} color={COLORS.success} />
              <Text style={styles.bannerText}>Homework posted successfully!</Text>
            </View>
          )}

          {/* ⚡ NEW CLASS SELECTION SECTION CHIPS (Super Easy to Assign) */}
          <Text style={styles.label}>Target Class *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRow} contentContainerStyle={styles.rowPadding}>
            {CLASSES.map((c) => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, selectedClass === c && styles.chipActive]}
                onPress={() => setSelectedClass(c)}
              >
                <Text style={[styles.chipText, selectedClass === c && styles.chipTextActive]}>Class {c}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Subject</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalRow} contentContainerStyle={styles.rowPadding}>
            {SUBJECTS.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, subject === s && styles.chipActive]}
                onPress={() => setSubject(s)}
              >
                <Text style={[styles.chipText, subject === s && styles.chipTextActive]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Chapter 5 - Exercise 5.2"
            placeholderTextColor={COLORS.textMuted}
          />

          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, { height: 120 }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Detailed instructions for the homework..."
            placeholderTextColor={COLORS.textMuted}
            multiline
          />

          <Text style={styles.label}>Due Date (YYYY-MM-DD) *</Text>
          <TextInput
            style={styles.input}
            value={dueDate}
            onChangeText={setDueDate}
            placeholder="2026-07-15"
            placeholderTextColor={COLORS.textMuted}
          />

          <TouchableOpacity
            style={[styles.submitBtn, (!title || !description || !dueDate || !selectedClass) && { opacity: 0.5 }]}
            disabled={saving || !title || !description || !dueDate || !selectedClass}
            onPress={submit}
          >
            {saving ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="cloud-upload" size={18} color="#fff" />
                <Text style={styles.submitText}>Post Homework</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenHeader>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, gap: 10 },
  banner: {
    flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#E6F7EF",
    padding: 12, borderRadius: RADII.md,
  },
  bannerText: { color: COLORS.success, fontWeight: "700" },
  label: { fontSize: 12, color: COLORS.textMuted, fontWeight: "700", marginTop: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 },
  horizontalRow: { flexGrow: 0, maxHeight: 44, marginVertical: 2 },
  rowPadding: { gap: 8, paddingRight: 20, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, flexShrink: 0,
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: "700", color: COLORS.textMain },
  chipTextActive: { color: "#fff" },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.md,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: COLORS.textMain, backgroundColor: COLORS.surface,
    textAlignVertical: "top",
  },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginTop: 24, backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADII.lg,
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});