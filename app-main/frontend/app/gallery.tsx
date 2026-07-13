import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Modal, TextInput, ActivityIndicator,Platform, Dimensions, Alert } from "react-native";
import ScreenHeader from "@/src/components/ScreenHeader";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/AuthContext";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

const CLASSES = Array.from({ length: 12 }, (_, i) => `${i + 1}`);

export default function GalleryScreen() {
  const { user } = useAuth();
  const { t } = useLang();
  const [albums, setAlbums] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  const canEdit = user?.role === "teacher" || user?.role === "admin";

  // Create Album States
  const [uploadModalVisible, setUploadModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]); 
  const [targetClass, setTargetClass] = useState("10"); 
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null); 
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    const r = await api.get("/gallery/albums");
    setAlbums(r || []);
    
    // Agar modal khula hai toh updated state data refresh karenge
    if (selected) {
      const currentAlbumId = selected.album_id || selected._id;
      const updatedAlbum = (r || []).find((a: any) => (a.album_id || a._id) === currentAlbumId);
      if (updatedAlbum) {
        setSelected(updatedAlbum);
      } else {
        setSelected(null);
      }
    }
  }, [selected]);

  useEffect(() => { load(); }, []);

  // 📸 DEVICE GALLERY PICKER FUNCTION
  const pickImage = async () => {
    setFormError("");
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "We need storage access to pick images!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.4, 
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setSelectedImageBase64(result.assets[0].base64);
    }
  };

  // 🗑️ DELETE ALBUM ENGINE LINK - WEB & MOBILE FRIENDLY
  const handleDeleteAlbum = (albumId: string) => {
    // Web Browser environment validation check
    const confirmDelete = window.confirm ? window.confirm("Are you sure you want to completely remove this gallery entry?") : true;
    
    if (confirmDelete) {
      (async () => {
        try {
          await api.del(`/gallery/albums/${albumId}`);
          if (window.alert) window.alert("Album deleted successfully!");
          await load(); // Reload lists instantly mapping backend update
        } catch (err: any) {
          if (window.alert) window.alert(err?.message || "Could not delete album");
        }
      })();
    }
  };

  // 🗑️ SINGLE PHOTO DELETE HANDLER - WEB & MOBILE FRIENDLY
  const handleDeletePhoto = (albumId: string, photoIdx: number) => {
    const confirmDelete = window.confirm ? window.confirm("Are you sure you want to remove this photo from the album?") : true;
    
    if (confirmDelete) {
      (async () => {
        try {
          await api.del(`/gallery/albums/${albumId}/photos/${photoIdx}`);
          if (window.alert) window.alert("Photo deleted successfully!");
          
          // Local layout state reload refresh mapping
          const updatedAlbums = await api.get("/gallery/albums");
          setAlbums(updatedAlbums || []);
          
          const currentAlbum = (updatedAlbums || []).find((a: any) => (a.album_id || a._id) === albumId);
          if (currentAlbum && currentAlbum.photos_base64 && currentAlbum.photos_base64.length > 0) {
            setSelected(currentAlbum);
          } else {
            setSelected(null); 
          }
        } catch (err: any) {
          if (window.alert) window.alert(err?.message || "Could not delete photo");
        }
      })();
    }
  };

  const handleCreateAlbum = async () => {
    setFormError("");
    if (!title || !date) {
      setFormError("Event Title and Date are required.");
      return;
    }
    if (!selectedImageBase64) {
      setFormError("Please select a photo from your device first.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: title.trim(),
        event_date: date.trim(),
        class_id: targetClass,
        photos_base64: [selectedImageBase64] 
      };

      await api.post("/gallery/albums", payload);
      setUploadModalVisible(false);
      
      setTitle("");
      setSelectedImageBase64(null);
      await load(); 
    } catch (e: any) {
      setFormError(e?.message || "Failed to upload to server.");
    } finally {
      setLoading(false);
    }
  };

  const resolveImageSource = (item: any) => {
    if (item?.photos_base64 && item.photos_base64.length > 0 && item.photos_base64[0]) {
      return { uri: `data:image/jpeg;base64,${item.photos_base64[0]}` };
    }
    if (item?.cover_url && !item.cover_url.includes("placeholder")) {
      return { uri: item.cover_url };
    }
    return { uri: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600" };
  };

  return (
    <ScreenHeader title={t("gallery")} showBack>
      <ScrollView contentContainerStyle={styles.scroll}>
        {albums.length === 0 && <Text style={styles.empty}>{t("no_data")}</Text>}
        <View style={styles.grid}>
          {albums.map((a) => {
            const currentId = a.album_id || a._id;
            return (
              <View key={currentId} style={styles.tileWrapper}>
                <TouchableOpacity
                  style={styles.tile}
                  onPress={() => setSelected(a)}
                >
                  <Image source={resolveImageSource(a)} style={styles.cover} />
                  <View style={styles.overlay} />
                  <View style={styles.tileInfo}>
                    <Text style={styles.tileTitle} numberOfLines={2}>{a.title}</Text>
                    <Text style={styles.tileDate}>{a.event_date} {a.class_id ? `• Class ${a.class_id}` : ""}</Text>
                  </View>
                </TouchableOpacity>
                
                {/*  DELETE ENTIRE ALBUM BUTTON */}
                {canEdit && (
                  <TouchableOpacity style={styles.deleteBadge} onPress={() => handleDeleteAlbum(currentId)}>
                    <Ionicons name="trash-outline" size={16} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
        <View style={{ height: 100 }} />
      </ScrollView>

      {canEdit && (
        <TouchableOpacity style={styles.fabAdd} onPress={() => setUploadModalVisible(true)}>
          <Ionicons name="images" size={20} color="#fff" />
          <Text style={styles.fabText}>Add Album</Text>
        </TouchableOpacity>
      )}

      {/* VIEW DETAILS MODAL */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
              <Ionicons name="close" size={20} color={COLORS.textMain} />
            </TouchableOpacity>
            
            <View style={styles.imageContainer}>
              <Image source={resolveImageSource(selected)} style={styles.modalImg} />
              
              {/*  SINGLE PHOTO DELETE BUTTON OVERLAY */}
              {canEdit && (
                <TouchableOpacity 
                  style={styles.deletePhotoBadge} 
                  onPress={() => handleDeletePhoto(selected.album_id || selected._id, 0)}
                >
                  <Ionicons name="trash-outline" size={16} color="#fff" />
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.modalTitle}>{selected?.title}</Text>
            <Text style={styles.modalDate}>{selected?.event_date} {selected?.class_id ? `• Class ${selected?.class_id}` : ""}</Text>
            <Text style={styles.modalNote}>{(selected?.photos_base64?.length ?? 0)} photo(s) in album</Text>
          </View>
        </View>
      </Modal>

      {/* UPLOAD FORM MODAL SHEET */}
      <Modal visible={uploadModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.uploadContainer}>
          <View style={styles.uploadHeader}>
            <Text style={styles.uploadTitle}>Create Event Album</Text>
            <TouchableOpacity onPress={() => setUploadModalVisible(false)}>
              <Ionicons name="close" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.uploadScroll} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              <Text style={styles.label}>Event Title *</Text>
              <TextInput 
                style={styles.inputField}
                placeholder="e.g. Annual Sports Day 2026"
                value={title}
                onChangeText={setTitle}
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>Event Date (YYYY-MM-DD) *</Text>
              <TextInput 
                style={styles.inputField}
                placeholder="e.g. 2026-07-15"
                value={date}
                onChangeText={setDate}
                placeholderTextColor={COLORS.textMuted}
              />

              <Text style={styles.label}>Select Photos From Device Storage *</Text>
              {selectedImageBase64 ? (
                <View style={styles.previewContainer}>
                  <Image source={{ uri: `data:image/jpeg;base64,${selectedImageBase64}` }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.changePhotoBtn} onPress={pickImage}>
                    <Ionicons name="refresh" size={14} color="#fff" />
                    <Text style={styles.changePhotoText}>Change Image</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.imagePickerBox} onPress={pickImage}>
                  <Ionicons name="camera-outline" size={32} color={COLORS.textMuted} />
                  <Text style={styles.pickerBoxText}>Tap to Open Device Gallery</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.label}>Restrict to Specific Class (Optional)</Text>
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

          <View style={styles.uploadFooter}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleCreateAlbum} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Publish Gallery Album</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </ScreenHeader>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg },
  empty: { textAlign: "center", color: COLORS.textMuted, marginTop: 40 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  tileWrapper: { 
    width: Platform.OS === 'web' && Dimensions.get('window').width > 768 ? "23.5%" : "48%", 
    height: 180, 
    position: "relative" 
  },
  tile: { width: "100%", height: "100%", borderRadius: RADII.lg, overflow: "hidden", backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  cover: { width: "100%", height: "100%", position: "absolute" },
  overlay: { position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.35)" },
  tileInfo: { position: "absolute", bottom: 12, left: 12, right: 12 },
  tileTitle: { color: "#fff", fontSize: 14, fontWeight: "800" },
  tileDate: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 2 },
  
  deleteBadge: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(239, 68, 68, 0.9)", width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", zIndex: 10, elevation: 4, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 2 },
  
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { backgroundColor: COLORS.surface, borderRadius: RADII.xl, padding: SPACING.lg, gap: 8, width: "100%", maxWidth: 360 },
  closeBtn: { alignSelf: "flex-end", padding: 4 },
  imageContainer: { width: "100%", height: 220, position: "relative" },
  modalImg: { width: "100%", height: "100%", borderRadius: RADII.lg },
  deletePhotoBadge: { position: "absolute", top: 10, right: 10, backgroundColor: "rgba(239, 68, 68, 0.95)", width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", zIndex: 12, elevation: 5 },
  
  modalTitle: { fontSize: 18, fontWeight: "800", color: COLORS.textMain, marginTop: 8 },
  modalDate: { color: COLORS.textMuted, fontSize: 12 },
  modalNote: { color: COLORS.textMuted, fontSize: 12, fontStyle: "italic", marginTop: 4 },
  
  fabAdd: { position: "absolute", bottom: 30, right: 20, backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingVertical: 14, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 8, elevation: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4 },
  fabText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  
  uploadContainer: { flex: 1, backgroundColor: COLORS.bg },
  uploadHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: SPACING.lg, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  uploadTitle: { fontSize: 16, fontWeight: "800", color: COLORS.textMain },
  uploadScroll: { padding: SPACING.lg },
  formGroup: { gap: 4 },
  label: { fontSize: 13, color: COLORS.textMuted, fontWeight: "700", marginTop: 12, marginBottom: 4 },
  inputField: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.md, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: COLORS.textMain, backgroundColor: "#FAFAF9" },
  
  imagePickerBox: { borderStyle: "dashed", borderWidth: 2, borderColor: COLORS.border, borderRadius: RADII.lg, height: 120, alignItems: "center", justifyContent: "center", backgroundColor: "#FAFAF9", gap: 8, marginTop: 2, marginBottom: 6 },
  pickerBoxText: { fontSize: 13, color: COLORS.textMuted, fontWeight: "600" },
  previewContainer: { width: "100%", height: 160, borderRadius: RADII.lg, overflow: "hidden", marginTop: 2, marginBottom: 6 },
  previewImage: { width: "100%", height: "100%" },
  changePhotoBtn: { position: "absolute", bottom: 10, right: 10, backgroundColor: "rgba(0,0,0,0.7)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, flexDirection: "row", alignItems: "center", gap: 4 },
  changePhotoText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  classScroll: { gap: 8, paddingVertical: 4 },
  classChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADII.md, backgroundColor: "#FAFAF9", borderWidth: 1, borderColor: COLORS.border },
  classChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  classChipText: { fontSize: 13, fontWeight: "600", color: COLORS.textMain },
  classChipTextActive: { color: "#fff" },

  errorText: { color: COLORS.error, fontSize: 13, fontWeight: "600", marginTop: 12 },
  uploadFooter: { padding: SPACING.lg, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface },
  saveBtn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: RADII.lg, alignItems: "center" },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 }
});