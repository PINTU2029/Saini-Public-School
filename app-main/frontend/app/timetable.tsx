import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, ActivityIndicator } from "react-native";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/AuthContext";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";
import { Ionicons } from "@expo/vector-icons";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CLASSES = Array.from({ length: 12 }, (_, i) => `${i + 1}`);

export default function TimetableScreen() {
  const { user } = useAuth();
  const { t } = useLang();
  const [data, setData] = useState<any[]>([]);
  const todayIdx = new Date().getDay(); 
  const defaultDay = DAYS[Math.max(0, todayIdx - 1)] ?? "Monday";
  const [day, setDay] = useState<string>(defaultDay);
  
  const isAdmin = user?.role === "admin";
  
  //  Pehle sirf admin ke liye "10" default tha, ab sabke liye agar class_id nahi hai toh "1" ya "10" dikhega
  const initialClass = user?.class_id 
    ? user.class_id.replace("cls_", "") 
    : "10"; 
    
  const [selectedClass, setSelectedClass] = useState<string>(initialClass);

  // Edit Modal States
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editedPeriods, setEditedPeriods] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!selectedClass) return;
    setLoading(true);
    try {
      const res = await api.get(`/timetable/${selectedClass}`);
      setData(res || []);
    } catch (e) {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedClass]);

  useEffect(() => { load(); }, [load]);

  const dayData = data.find((d) => d.day === day);

  const openEditor = () => {
    const basePeriods = dayData?.periods ? JSON.parse(JSON.stringify(dayData.periods)) : 
      Array.from({ length: 6 }, () => ({ subject: "", teacher: "", time: "08:00 - 08:45" }));
    setEditedPeriods(basePeriods);
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        class_id: selectedClass,
        day: day,
        periods: editedPeriods.filter(p => p.subject && p.subject.trim() !== "")
      };
      await api.post("/timetable", payload);
      setEditModalVisible(false);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const updatePeriodField = (index: number, field: string, value: string) => {
    const updated = [...editedPeriods];
    updated[index] = { ...updated[index], [field]: value };
    setEditedPeriods(updated);
  };

  return (
    <ScreenHeader title={t("timetable")} showBack>
      
      {/*  UNIVERSAL CLASS SELECTOR: Ab ye isAdmin ke bahar hai, sab log use kar sakte hain */}
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>Select Class Schedule:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classScroll}>
          {CLASSES.map((c) => (
            <TouchableOpacity
              key={c}
              style={[styles.classChip, selectedClass === c && styles.classChipActive]}
              onPress={() => setSelectedClass(c)}
            >
              <Text style={[styles.classChipText, selectedClass === c && styles.classChipTextActive]}>Class {c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Day Selector Navigation Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.dayRow}
        style={{ maxHeight: 56, flexGrow: 0, marginTop: 10 }}
      >
        {DAYS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[styles.dayChip, day === d && styles.dayActive]}
            onPress={() => setDay(d)}
          >
            <Text style={[styles.dayText, day === d && styles.dayTextActive]}>{d.slice(0, 3)}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Central Timetable Ledger Records */}
      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : dayData && dayData.periods && dayData.periods.length > 0 ? (
          dayData.periods.map((p: any, i: number) => (
            <View key={i} style={styles.card}>
              <View style={styles.periodNum}>
                <Text style={styles.periodNumText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.subject}>{p.subject}</Text>
                <Text style={styles.meta}>{p.teacher}</Text>
              </View>
              <Text style={styles.time}>{p.time}</Text>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color={COLORS.textMuted} style={{ opacity: 0.5 }} />
            <Text style={styles.empty}>No timetable configured for Class {selectedClass} on {day}.</Text>
          </View>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/*  FLOATING FAB EDITOR BUTTON: Ye abhi bhi sirf Admin ko dikhega (Security) */}
      {isAdmin && (
        <TouchableOpacity style={styles.fabEdit} onPress={openEditor}>
          <Ionicons name="create" size={20} color="#fff" />
          <Text style={styles.fabText}>Edit Schedule</Text>
        </TouchableOpacity>
      )}

      {/* MODAL EDITOR: Only for Admin Actions */}
      <Modal visible={editModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Class {selectedClass} • {day}</Text>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={{paddingBottom: 40}}>
            {editedPeriods.map((p, idx) => (
              <View key={idx} style={styles.editCard}>
                <View style={styles.editRowHeader}>
                  <Text style={styles.editIndexLabel}>Period {idx + 1}</Text>
                </View>
                
                <View style={styles.inputGroup}>
                  <TextInput 
                    style={styles.modalInput}
                    placeholder="Subject Name"
                    value={p.subject}
                    onChangeText={(val) => updatePeriodField(idx, "subject", val)}
                  />
                  <TextInput 
                    style={styles.modalInput}
                    placeholder="Teacher Name"
                    value={p.teacher}
                    onChangeText={(val) => updatePeriodField(idx, "teacher", val)}
                  />
                  <TextInput 
                    style={styles.modalInput}
                    placeholder="Time Frame (e.g. 09:00 - 09:45)"
                    value={p.time}
                    onChangeText={(val) => updatePeriodField(idx, "time", val)}
                  />
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save Timetable Modifications</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScreenHeader>
  );
}

const styles = StyleSheet.create({
  selectorContainer: { paddingHorizontal: SPACING.lg, paddingTop: 12, gap: 8 },
  selectorLabel: { fontSize: 13, fontWeight: "800", color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  classScroll: { gap: 8, paddingVertical: 2 },
  classChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADII.md, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  classChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  classChipText: { fontSize: 13, fontWeight: "700", color: COLORS.textMain },
  classChipTextActive: { color: "#fff" },
  dayRow: { paddingHorizontal: SPACING.lg, gap: 8, height: 56, alignItems: "center" },
  dayChip: { paddingHorizontal: 16, height: 38, borderRadius: 12, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  dayActive: { backgroundColor: COLORS.secondary, borderColor: COLORS.secondary },
  dayText: { fontSize: 13, fontWeight: "700", color: COLORS.textMain },
  dayTextActive: { color: "#fff" },
  scroll: { padding: SPACING.lg, gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: RADII.lg, borderWidth: 1, borderColor: COLORS.border },
  periodNum: { width: 38, height: 38, borderRadius: 10, backgroundColor: COLORS.chipBg, alignItems: "center", justifyContent: "center" },
  periodNumText: { fontWeight: "800", color: COLORS.primary },
  subject: { fontSize: 15, fontWeight: "800", color: COLORS.textMain },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  time: { fontSize: 12, color: COLORS.textMuted, fontWeight: "600" },
  emptyContainer: { alignItems: "center", justifyContent: "center", marginTop: 60, gap: 12, paddingHorizontal: SPACING.xl },
  empty: { textAlign: "center", color: COLORS.textMuted, fontSize: 14, lineHeight: 20 },
  fabEdit: { position: "absolute", bottom: 30, right: 20, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 8, elevation: 5 },
  fabText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  modalContainer: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  modalTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textMain },
  modalScroll: { padding: SPACING.lg },
  editCard: { backgroundColor: COLORS.surface, borderRadius: RADII.lg, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: COLORS.border, gap: 8 },
  editRowHeader: { borderBottomWidth: 1, borderBottomColor: COLORS.border + "22", paddingBottom: 4 },
  editIndexLabel: { fontSize: 13, fontWeight: "800", color: COLORS.primary },
  inputGroup: { gap: 8, marginTop: 4 },
  modalInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.md, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: COLORS.textMain, backgroundColor: "#FAFAF9" },
  modalFooter: { padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  saveBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADII.lg, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 }
});