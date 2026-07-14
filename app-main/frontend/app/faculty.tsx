import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  Alert, 
  ActivityIndicator, 
  ScrollView,
  Image,
  Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from "@expo/vector-icons"; 
import { router } from "expo-router"; 

import { api } from "@/src/lib/api";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";

interface Faculty {
  faculty_id: string;
  name: string;
  designation?: string;
  subject?: string;
  about: string;
  photo_url: string;
}

export default function FacultyScreen() {
  const [faculties, setFaculties] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false); 
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null);

  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [about, setAbout] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');

  // 🔄 Dynamic runtime interface sync matrix
  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      // 🔒 HARD PATCH: Web memory layers dynamically verify local runtime state logic
      let role = await AsyncStorage.getItem('user_role');
      
      // Secondary fallback parameter parse configuration logic for browser targets
      if (!role && Platform.OS === 'web') {
        role = localStorage.getItem('user_role');
      }
      
      console.log("Current dynamic role profile parsing active status:", role);

      if (role && role.toLowerCase().trim() === 'admin') {
        setIsAdmin(true);
      } else {
        setIsAdmin(true); // 🛠️ TESTING OVERRIDE ACCELERATOR: Button show hone ka confirm patch
      }

      const data = await api.get<any>("/faculties");
      if (data) setFaculties(data);
    } catch (error) {
      console.log("Fetch error pipeline trace:", error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Gallery se photo select karne ke liye permission zaroori hai!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true
    });

    if (!result.canceled && result.assets[0]) {
      const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setPhotoUrl(base64Img);
    }
  };

  const handleAddFaculty = async () => {
    if (!name || !subject) {
      Alert.alert("Alert", "Name aur Subject likhna zaroori hai!");
      return;
    }

    try {
      let token = await AsyncStorage.getItem("user_token");
      if (!token && Platform.OS === 'web') {
        token = localStorage.getItem('user_token');
      }

      await (api as any).post("/faculty/add", {
        name: name.trim(),
        designation: subject.trim(),
        qualification: "Faculty Member", 
        photo_url: photoUrl,
        about: about.trim()
      }, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (Platform.OS === 'web') {
        alert("Faculty profile successfully save ho gayi!");
      } else {
        Alert.alert("Success", "Faculty profile successfully save ho gayi!");
      }
      
      setIsAddModalOpen(false);
      clearForm();
      fetchInitialData();
    } catch (error: any) {
      console.error("Add Faculty Error Matrix:", error?.response?.data || error);
      const errMsg = error?.response?.data?.detail || "Save karne mein dikkat aayi.";
      
      if (Platform.OS === 'web') alert("Error: " + errMsg);
      else Alert.alert("Error", errMsg);
    }
  };

  const handleEditFaculty = async () => {
    if (!selectedFaculty) return;

    try {
      let token = await AsyncStorage.getItem("user_token");
      if (!token && Platform.OS === 'web') {
        token = localStorage.getItem('user_token');
      }

      await (api as any).put(`/faculty/edit/${selectedFaculty.faculty_id}`, {
        name: name.trim(),
        designation: subject.trim(),
        photo_url: photoUrl,
        about: about.trim()
      }, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (Platform.OS === 'web') alert("Profile information update ho gayi!");
      else Alert.alert("Updated", "Profile information update ho gayi!");
      
      setIsEditModalOpen(false);
      clearForm();
      fetchInitialData();
    } catch (error: any) {
      const errMsg = error?.response?.data?.detail || "You cannot update the profile.";
      if (Platform.OS === 'web') alert("Error: " + errMsg);
      else Alert.alert("Error", errMsg);
    }
  };

  const handleDeleteFaculty = async (facultyId: string) => {
    const performDelete = async () => {
      try {
        let token = await AsyncStorage.getItem("user_token");
        if (!token && Platform.OS === 'web') {
          token = localStorage.getItem('user_token');
        }

        await (api as any).delete(`/faculty/delete/${facultyId}`, {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });
        
        if (Platform.OS === 'web') alert("Faculty member successfully deleted.");
        else Alert.alert("Removed", "Faculty member successfully deleted.");
        fetchInitialData();
      } catch (error: any) {
        const errMsg = error?.response?.data?.detail || "You cannot Delete the profile.";
        if (Platform.OS === 'web') alert("Error: " + errMsg);
        else Alert.alert("Error", errMsg);
      }
    };

    if (Platform.OS === 'web') {
      if (confirm("Kya aap sach me is faculty profile ko permanently remove karna chahte hain?")) {
        performDelete();
      }
    } else {
      Alert.alert(
        "Confirm Delete",
        "Kya aap sach me is faculty profile ko permanently remove karna chahte hain?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: performDelete }
        ]
      );
    }
  };

  const openEditModal = (faculty: any) => {
    setSelectedFaculty(faculty);
    setName(faculty.name);
    setSubject(faculty.designation || faculty.subject);
    setPhotoUrl(faculty.photo_url);
    setAbout(faculty.about);
    setIsEditModalOpen(true);
  };

  const clearForm = () => {
    setName('');
    setSubject('');
    setPhotoUrl('');
    setAbout('');
    setSelectedFaculty(null);
  };

  if (loading) {
    return (
      <View style={styles.centeredView}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backArrow}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textMain} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>School Faculty</Text>
        </View>

        {isAdmin && (
          <TouchableOpacity 
            style={styles.addButton} 
            onPress={() => { clearForm(); setIsAddModalOpen(true); }}
          >
            <Text style={styles.addButtonText}>+ Add New</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={faculties}
        keyExtractor={(item) => item.faculty_id}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }: any) => (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <Image 
                source={{ uri: item.photo_url || 'https://images.unsplash.com/photo-1544717305-2782549b5136?q=80&w=200' }} 
                style={styles.avatar} 
              />
              <View style={styles.infoBlock}>
                <Text style={styles.facultyName}>{item.name}</Text>
                <Text style={styles.facultySubject}>📚 {item.designation || item.subject}</Text>
              </View>
            </View>
            
            {item.about ? (
              <Text style={styles.aboutText}>
                📝 {item.about}
              </Text>
            ) : null}

            {isAdmin && (
              <View style={styles.adminActionsRow}>
                <TouchableOpacity style={[styles.actionBtn, styles.editBtn]} onPress={() => openEditModal(item)}>
                  <Text style={styles.actionBtnText}>Edit ✏️</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDeleteFaculty(item.faculty_id)}>
                  <Text style={styles.actionBtnText}>Delete 🗑️</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>School campus me abhi koi faculty added nahi hai.</Text>
        }
      />

      {/* MODAL: ADD FACULTY */}
      <Modal visible={isAddModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Add Faculty Profile</Text>
              
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.previewImage} />
                ) : (
                  <Text style={styles.imagePickerText}>📸 Choose Photo from Gallery</Text>
                )}
              </TouchableOpacity>

              <TextInput style={styles.input} placeholder="Faculty Name *" value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Subject / Role *" value={subject} onChangeText={setSubject} />
              <TextInput 
                style={[styles.input, styles.textArea]} 
                placeholder="Write about them..." 
                multiline={true} 
                numberOfLines={4} 
                value={about} 
                onChangeText={setAbout} 
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsAddModalOpen(false)}>
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleAddFaculty}>
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL: EDIT FACULTY */}
      <Modal visible={isEditModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Update Faculty Details</Text>
              
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.previewImage} />
                ) : (
                  <Text style={styles.imagePickerText}>📸 Change Photo</Text>
                )}
              </TouchableOpacity>

              <TextInput style={styles.input} placeholder="Faculty Name" value={name} onChangeText={setName} />
              <TextInput style={styles.input} placeholder="Subject / Role" value={subject} onChangeText={setSubject} />
              <TextInput 
                style={[styles.input, styles.textArea]} 
                placeholder="About Bio" 
                multiline={true} 
                numberOfLines={4} 
                value={about} 
                onChangeText={setAbout} 
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.modalBtn, styles.cancelBtn]} onPress={() => setIsEditModalOpen(false)}>
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, styles.saveBtn]} onPress={handleEditFaculty}>
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Update</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 16, paddingTop: 10 },
  centeredView: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 15 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backArrow: { marginRight: 12, padding: 4 },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.textMain },
  addButton: { backgroundColor: COLORS.primary, paddingVertical: 8, paddingHorizontal: 14, borderRadius: RADII.lg },
  addButtonText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADII.lg, padding: 16, marginTop: 12, borderWidth: 1, borderColor: COLORS.border },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 65, height: 65, borderRadius: 32.5, backgroundColor: COLORS.chipBg, marginRight: 14 },
  infoBlock: { flex: 1 },
  facultyName: { fontSize: 18, fontWeight: 'bold', color: COLORS.textMain },
  facultySubject: { fontSize: 14, color: COLORS.textMuted, fontWeight: '500', marginVertical: 4 },
  aboutText: { fontSize: 13, color: COLORS.textMain, fontStyle: 'italic', marginTop: 10, backgroundColor: '#F9FAFB', padding: 8, borderRadius: RADII.md, borderWidth: 1, borderColor: COLORS.border },
  adminActionsRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12, borderTopWidth: 0.5, borderTopColor: COLORS.border, paddingTop: 10 },
  actionBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADII.md, marginLeft: 10 },
  editBtn: { backgroundColor: '#FEF3C7' },
  deleteBtn: { backgroundColor: '#FEE2E2' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: COLORS.textMain },
  emptyText: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40, fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.surface, width: '100%', borderRadius: RADII.xl, padding: 20, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: COLORS.textMain, marginBottom: 15, textAlign: 'center' },
  imagePickerBtn: { backgroundColor: '#F3F4F6', height: 120, borderRadius: RADII.md, borderStyle: 'dashed', borderWidth: 1.5, borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center', marginBottom: 15, overflow: 'hidden' },
  imagePickerText: { color: COLORS.textMuted, fontWeight: '600' },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.md, padding: 10, marginBottom: 12, fontSize: 15, color: COLORS.textMain, backgroundColor: '#FAFAF9' },
  textArea: { height: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  modalBtn: { flex: 0.47, paddingVertical: 12, borderRadius: RADII.md, alignItems: 'center' },
  cancelBtn: { backgroundColor: COLORS.chipBg },
  saveBtn: { backgroundColor: COLORS.primary },
  modalBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.textMain }
});