import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Modal, TextInput, ActivityIndicator } from "react-native";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/AuthContext";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";
import { Ionicons } from "@expo/vector-icons";

const ICON_BY_KIND: Record<string, any> = {
  video: "videocam",
  pdf: "document",
  notes: "document-text",
};

const CLASSES = Array.from({ length: 12 }, (_, i) => `${i + 1}`);

export default function LmsScreen() {
  const { user } = useAuth();
  const { t } = useLang();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");

  //  Role verification flags
  const canEdit = user?.role === "teacher" || user?.role === "admin";

  // Upload Form Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");
  
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState("pdf"); // Default select kind
  const [url, setUrl] = useState("");
  const [targetClass, setTargetClass] = useState("10"); // Default Class 10

  const load = useCallback(async () => {
    // Agar teacher/admin hai toh user?.class_id restrict nahi karega, query param optional chalega backend route par
    const r = await api.get("/lms/materials");
    setItems(r || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const subjects = Array.from(new Set(items.map((i) => i.subject)));
  const filtered = filter === "all" ? items : items.filter((i) => i.subject === filter);

  // Submit dynamic upload payload details to backend endpoint
  const handleUpload = async () => {
    setFormError("");
    if (!title || !subject || !url) {
      setFormError("Title, Subject, and Material URL are required.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        subject: subject.trim(),
        description: description.trim(),
        kind: kind,
        url: url.trim(),
        class_id: targetClass,
        content_base64: null // Fallback placeholder asset parameter
      };

      await api.post("/lms/materials", payload);
      setModalVisible(false);
      
      // Form values reset sequence
      setTitle("");
      setSubject("");
      setDescription("");
      setUrl("");
      
      await load(); // Reload structural feed elements
    } catch (e: any) {
      setFormError(e?.message || "Failed to upload study material");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenHeader title={t("lms")} showBack>
      
      {/* Dynamic Subjects Navigation Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRow}
        style={{ maxHeight: 56, flexGrow: 0 }}
      >
        <FilterChip label="All" active={filter === "all"} onPress={() => setFilter("all")} />
        {subjects.map((s) => (
          <FilterChip key={s} label={s} active={filter === s} onPress={() => setFilter(s)} />
        ))}
      </ScrollView>

      {/* Main Material Scroll View Ledger */}
      <ScrollView contentContainerStyle={styles.scroll}>
        {filtered.length === 0 && <Text style={styles.empty}>{t("no_data")}</Text>}
        {filtered.map((it) => (
          <TouchableOpacity
            key={it.material_id}
            style={styles.card}
            onPress={() => {
              if (it.url) Linking.openURL(it.url).catch(() => {});
            }}
          >
            <View style={[styles.icon, it.kind === "video" && { backgroundColor: "#FDECEC" }]}>
              <Ionicons name={ICON_BY_KIND[it.kind] ?? "book"} size={22} color={it.kind === "video" ? COLORS.error : COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{it.title}</Text>
              <Text style={styles.meta}>
                {it.subject} • {it.kind.toUpperCase()} {it.class_id ? `• Class ${it.class_id}` : ""}
              </Text>
              {it.description ? <Text style={styles.desc} numberOfLines={2}>{it.description}</Text> : null}
            </View>
            {it.url && <Ionicons name="open-outline" size={20} color={COLORS.textMuted} />}
          </TouchableOpacity>
        ))}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ➕ FLOATING UPLOAD FAB ICON BUTTON (Visible to Teachers & Admins) */}
      {canEdit && (
        <TouchableOpacity style={styles.fabAdd} onPress={() => setModalVisible(true)}>
          <Ionicons name="cloud-upload" size={20} color="#fff" />
          <Text style={styles.fabText}>Add Material</Text>
        </TouchableOpacity>
      )}

      {/* ⚙️ FULL PANEL ASSIGNED LMS MATERIAL UPLOADER MODAL GRID */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Upload Study Material</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              
              <Text style={styles.label}>Material Title *</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="e.g. Chapter 3: Organic Chemistry Notes"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>Subject *</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="e.g. Chemistry"
                value={subject}
                onChangeText={setSubject}
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>Resource Link URL *</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="e.g. https://drive.google.com/pdf_file"
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput 
                style={[styles.modalInput, { height: 70, textAlignVertical: "top" }]} 
                placeholder="Brief summary about topics covered..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                placeholderTextColor={COLORS.textMuted}
              />

              {/* Kind Type Select Filter Chips */}
              <Text style={styles.label}>Material Kind Type</Text>
              <View style={styles.kindRow}>
                {["pdf", "video", "notes"].map((k) => (
                  <TouchableOpacity 
                    key={k} 
                    style={[styles.kindChip, kind === k && styles.kindChipActive]}
                    onPress={() => setKind(k)}
                  >
                    <Text style={[styles.kindChipText, kind === k && styles.kindChipTextActive]}>{k.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Dynamic Target Class Array Chips */}
              <Text style={styles.label}>Assign to Class Target</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classScroll}>
                {CLASSES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.classChip, targetClass === c && styles.classChipActive]}
                    onPress={() => setTargetClass(c)}
                  >
                    <Text style={[styles.classChipText, targetClass === c && styles.classChipTextActive]}>Class {c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {formError ? <Text style={styles.errorText}>{formError}</Text> : null}
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleUpload} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Publish Material Content</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScreenHeader>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chipRow: { paddingHorizontal: SPACING.lg, gap: 8, height: 56, alignItems: "center" },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 999, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13, fontWeight: "700", color: COLORS.textMain },
  chipTextActive: { color: "#fff" },
  scroll: { padding: SPACING.lg, gap: 10 },
  empty: { textAlign: "center", color: COLORS.textMuted, marginTop: 40 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: RADII.lg, borderWidth: 1, borderColor: COLORS.border },
  icon: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.chipBg, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontWeight: "800", color: COLORS.textMain },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  desc: { fontSize: 12, color: COLORS.textMuted, marginTop: 6, lineHeight: 16 },
  
  // Floating action button FAB
  fabAdd: { position: "absolute", bottom: 30, right: 20, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 8, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4 },
  fabText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  
  // Uploader Modal interface layout stylings
  modalContainer: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  modalTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textMain },
  modalScroll: { padding: SPACING.lg },
  formGroup: { gap: 4 },
  label: { fontSize: 13, color: COLORS.textMuted, fontWeight: "700", marginTop: 12, marginBottom: 4 },
  modalInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.textMain, backgroundColor: "#FAFAF9" },
  
  kindRow: { flexDirection: "row", gap: 8, marginTop: 2 },
  kindChip: { flex: 1, paddingVertical: 10, borderRadius: RADII.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: "#FAFAF9", alignItems: "center" },
  kindChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  kindChipText: { fontSize: 12, fontWeight: "700", color: COLORS.textMain },
  kindChipTextActive: { color: "#fff" },

  classScroll: { gap: 8, paddingVertical: 4 },
  classChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADII.md, backgroundColor: "#FAFAF9", borderWidth: 1, borderColor: COLORS.border },
  classChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  classChipText: { fontSize: 13, fontWeight: "600", color: COLORS.textMain },
  classChipTextActive: { color: "#fff" },

  errorText: { color: COLORS.error, fontSize: 13, fontWeight: "600", marginTop: 12 },
  modalFooter: { padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  saveBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADII.lg, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 }
});