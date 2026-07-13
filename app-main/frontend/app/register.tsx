import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/lib/AuthContext";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";

const CLASSES = Array.from({ length: 12 }, (_, i) => `${i + 1}`);

export default function RegisterScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useLang();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"student" | "parent">("student");
  const [selectedClass, setSelectedClass] = useState("1"); 
  const [wantBus, setWantBus] = useState(false); 
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  //  OTP Verification State Management Flags
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  //  STEP 1: Form Validation & Triggering OTP Email Transmission
  async function onSubmit() {
    setError("");

    if (role !== "student" && role !== "parent") {
      setError("Invalid role selection framework configuration detected.");
      return;
    }

    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill all fields");
      return;
    }
    if (name.length < 2) {
      setError("Name must be at least 2 characters long");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password and Confirm Password do not match");
      return;
    }

    setLoading(true);
    try {
      //  Dynamic URL Generation
      const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8000";
      
      const response = await fetch(`${BASE_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Failed to initiate OTP check");
      }

      setOtpError("");
      setOtpInput("");
      setOtpModalVisible(true);

    } catch (e: any) {
      setError(e?.message || "Verification setup failed. Check backend connectivity.");
    } finally {
      setLoading(false);
    }
  }

  //  STEP 2: Validate OTP Token & Finalize User DB Registration Pipeline
  async function onVerifyAndRegister() {
    setOtpError("");
    if (otpInput.trim().length !== 6) {
      setOtpError("Please enter a valid 6-digit code");
      return;
    }

    setOtpLoading(true);
    try {
      // Dynamic URL Generation
      const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8000";

      // Part A: Cross check verify OTP
      const verifyRes = await fetch(`${BASE_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otpInput.trim(),
        }),
      });

      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        throw new Error(verifyData.detail || "Invalid code entered.");
      }

      // Part B: OTP verified successfully! Trigger final main system registration endpoint.
      const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password: password,
          confirm_password: confirmPassword,
          role: role,
          class_id: role === "student" ? selectedClass : null,
          bus_facility: role === "student" ? wantBus : false,
        }),
      });

      const registerData = await registerRes.json();

      if (!registerRes.ok) {
        throw new Error(registerData.detail || "Registration processing failure.");
      }

      setOtpModalVisible(false);
      router.replace("/login");

    } catch (e: any) {
      setOtpError(e?.message || "Transaction validation collapsed.");
    } finally {
      setOtpLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={COLORS.textMain} />
            </TouchableOpacity>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Join us to get started</Text>
          </View>

          <View style={styles.body}>
            <View style={styles.formCard}>
              
              {/* Full Name */}
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Enter your Name"
                placeholderTextColor={COLORS.textMuted}
              />

              {/* Email */}
              <Text style={styles.label}>{t("email") || "Email"}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter Your Valid Email"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              {/* Role Select */}
              <Text style={styles.label}>Select Role</Text>
              {Platform.OS === "web" ? (
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  style={styles.webSelect}
                >
                  <option value="student">Student</option>
                  <option value="parent">Parent</option>
                </select>
              ) : (
                <View style={styles.mobileChipContainer}>
                  {["student", "parent"].map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleChip, role === r && styles.roleChipActive]}
                      onPress={() => setRole(r as any)}
                    >
                      <Text style={[styles.roleChipText, role === r && styles.roleChipTextActive]}>
                        {r.charAt(0).toUpperCase() + r.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Dynamic Class Selector: Only for Student */}
              {role === "student" && (
                <View style={{ marginTop: 6 }}>
                  <Text style={styles.label}>Choose Class</Text>
                  {Platform.OS === "web" ? (
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                      style={styles.webSelect}
                    >
                      {CLASSES.map((c) => (
                        <option key={c} value={c}>Class {c}</option>
                      ))}
                    </select>
                  ) : (
                    <ScrollView 
                      horizontal 
                      showsHorizontalScrollIndicator={false} 
                      contentContainerStyle={styles.classScroll}
                    >
                      {CLASSES.map((c) => (
                        <TouchableOpacity
                          key={c}
                          style={[styles.classChip, selectedClass === c && styles.classChipActive]}
                          onPress={() => setSelectedClass(c)}
                        >
                          <Text style={[styles.classChipText, selectedClass === c && styles.classChipTextActive]}>
                            Class {c}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}

                  {/*  Dynamic Bus Selector Toggle Component */}
                  <Text style={styles.label}>Require School Bus Facility?</Text>
                  <View style={styles.busToggleRow}>
                    <TouchableOpacity 
                      style={[styles.busBtn, !wantBus && styles.busBtnActiveAbsent]}
                      onPress={() => setWantBus(false)}
                    >
                      <Text style={[styles.busBtnText, !wantBus && styles.busBtnTextActive]}>No Bus</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.busBtn, wantBus && styles.busBtnActivePresent]}
                      onPress={() => setWantBus(true)}
                    >
                      <Ionicons name="bus-outline" size={14} color={wantBus ? "#fff" : COLORS.textMain} style={{marginRight: 4}} />
                      <Text style={[styles.busBtnText, wantBus && styles.busBtnTextActive]}>Yes, Need Bus</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Password */}
              <Text style={styles.label}>{t("password") || "Password"}</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
              />

              {/* Confirm Password */}
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* Submit Button */}
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={onSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>Register</Text>
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => router.push("/login")} style={styles.loginLinkWrap}>
              <Text style={styles.loginLinkText}>
                Already have an account? <Text style={{ color: COLORS.primary, fontWeight: "700" }}>Login</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/*  SECURITY MODAL POP-UP LAYER: EMAIL OTP SUBMIT */}
      <Modal visible={otpModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Verification OTP</Text>
            <Text style={styles.modalSubtitle}>We have transmitted a 6-digit confirmation key to {email}</Text>
            
            <TextInput
              placeholder="000000"
              placeholderTextColor={COLORS.textMuted}
              value={otpInput}
              onChangeText={setOtpInput}
              keyboardType="number-pad"
              maxLength={6}
              style={styles.otpInputBox}
            />

            {otpError ? <Text style={styles.otpErrorText}>{otpError}</Text> : null}

            <View style={styles.modalButtonsRow}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => setOtpModalVisible(false)}
                disabled={otpLoading}
              >
                <Text style={{ color: COLORS.textMain, fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.modalVerifyBtn} 
                onPress={onVerifyAndRegister}
                disabled={otpLoading}
              >
                {otpLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Verify & Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 32 },
  header: { paddingHorizontal: SPACING.lg, marginTop: SPACING.lg },
  backBtn: { marginBottom: SPACING.md, width: 40 },
  title: { fontSize: 30, fontWeight: "800", color: COLORS.textMain, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, marginTop: 4 },
  body: { paddingHorizontal: SPACING.lg },
  formCard: {
    backgroundColor: COLORS.surface,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: { fontSize: 13, color: COLORS.textMuted, marginTop: 12, marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textMain,
    backgroundColor: "#FAFAF9",
  },
  webSelect: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    padding: 12,
    fontSize: 15,
    color: COLORS.textMain,
    backgroundColor: "#FAFAF9",
    width: "100%",
    outline: "none",
  },
  mobileChipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADII.md,
    backgroundColor: "#FAFAF9",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  roleChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleChipText: {
    fontSize: 14,
    color: COLORS.textMain,
    fontWeight: "600",
  },
  roleChipTextActive: {
    color: "#fff",
  },
  classScroll: {
    gap: 8,
    paddingVertical: 4,
    marginBottom: 4
  },
  classChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADII.md,
    backgroundColor: "#FAFAF9",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  classChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  classChipText: {
    fontSize: 14,
    color: COLORS.textMain,
    fontWeight: "600",
  },
  classChipTextActive: {
    color: "#fff",
  },
  busToggleRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
    marginBottom: 4
  },
  busBtn: {
    flex: 1,
    flexDirection: "row",
    height: 40,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FAFAF9",
    alignItems: "center",
    justifyContent: "center"
  },
  busBtnActivePresent: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary
  },
  busBtnActiveAbsent: {
    backgroundColor: COLORS.terracotta,
    borderColor: COLORS.terracotta
  },
  busBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.textMain
  },
  busBtnTextActive: {
    color: "#fff"
  },
  error: { color: COLORS.error, marginTop: 12, fontSize: 13, fontWeight: "600" },
  submitBtn: {
    marginTop: SPACING.xl,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADII.lg,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
  loginLinkWrap: { marginTop: 24, alignItems: "center", marginBottom: 20 },
  loginLinkText: { color: COLORS.textMuted, fontSize: 14 },

  //  MODAL STYLING CONFIGURATIONS
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" },
  modalContent: { width: "88%", maxWidth: 400, backgroundColor: COLORS.surface, borderRadius: RADII.xl, padding: 24, alignItems: "center", borderWidth: 1, borderColor: COLORS.border },
  modalTitle: { fontSize: 20, fontWeight: "800", color: COLORS.textMain, marginBottom: 8 },
  modalSubtitle: { fontSize: 13, color: COLORS.textMuted, textAlign: "center", marginBottom: 20, paddingHorizontal: 10 },
  otpInputBox: { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: RADII.md, padding: 12, width: "70%", textAlign: "center", fontSize: 22, fontWeight: "700", letterSpacing: 4, backgroundColor: "#FAFAF9", color: COLORS.textMain },
  otpErrorText: { color: COLORS.error, fontSize: 13, fontWeight: "600", marginTop: 10 },
  modalButtonsRow: { flexDirection: "row", gap: 12, width: "100%", marginTop: 20 },
  modalCancelBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, paddingVertical: 12, borderRadius: RADII.md, alignItems: "center", justifyContent: "center" },
  modalVerifyBtn: { flex: 1, backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: RADII.md, alignItems: "center", justifyContent: "center" }
});