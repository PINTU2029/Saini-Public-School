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
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router"; // <-- Navigation ke liye import kiya
import { useAuth } from "@/src/lib/AuthContext";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";


export default function LoginScreen() {
  const router = useRouter(); // <-- Router initialize kiya
  const { login } = useAuth();
  const { t, lang, setLang } = useLang();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit() {
    setError("");
    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }
   setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (e: any) {
      setError(e?.message || "Login failed");
    } finally {
      setLoading(false);
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
            <View style={styles.logoWrap}>
              <Image
               source={require("@/assets/images/icon.png")} 
                style={styles.hero}
                />
              <View style={styles.heroOverlay} />
              <View style={styles.logoBadge}>
                <Ionicons name="school" size={32} color={COLORS.primary} />
              </View>
            </View>
            <TouchableOpacity
              testID="lang-toggle"
              style={styles.langToggle}
              onPress={() => setLang(lang === "en" ? "hi" : "en")}
            >
              <Ionicons name="language" size={16} color={COLORS.primary} />
              <Text style={styles.langToggleText}>{lang === "en" ? "हिं" : "EN"}</Text>
            </TouchableOpacity>
          </View>

  

            <View style={styles.body}>
               {/*  Title ko direct change kiya */}
              <Text style={styles.title}>Saini Public School</Text> 

              {/*  Subtitle/Tagline ko direct change kiya */}
              <Text style={styles.subtitle}>Smart School. Happy Children.</Text>

            <View style={styles.formCard}>
              <Text style={styles.label}>{t("email")}</Text>
              <TextInput
                testID="login-email-input"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter Email Id"
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />

              <Text style={styles.label}>{t("password")}</Text>
              <TextInput
                testID="login-password-input"
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
              />

              {error ? (
                <Text style={styles.error} testID="login-error">
                  {error}
                </Text>
              ) : null}

              <TouchableOpacity
                testID="login-submit-button"
                style={styles.submitBtn}
                onPress={onSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>{t("login")}</Text>
                )}
              </TouchableOpacity>

              {/* ---- REGISTER LINK STARTS HERE ---- */}
              <TouchableOpacity
                onPress={() => router.push("/register")}
                style={styles.registerLinkWrap}
              >
                <Text style={styles.registerLinkText}>
                  Don't have an account?{" "}
                  <Text style={styles.registerLinkAction}>Register here</Text>
                </Text>
              </TouchableOpacity>
              {/* ---- REGISTER LINK ENDS HERE ---- */}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { paddingBottom: 32 },
  header: { height: 200, position: "relative" },
  logoWrap: { flex: 1, position: "relative" },
  hero: { width: "100%", height: "100%" },
  heroOverlay: {
    position: "absolute",
    inset: 0,
    backgroundColor: "rgba(44,95,45,0.55)",
  },
  logoBadge: {
    position: "absolute",
    bottom: -28,
    left: SPACING.lg,
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  langToggle: {
    position: "absolute",
    top: SPACING.md,
    right: SPACING.lg,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  langToggleText: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },
  body: { paddingHorizontal: SPACING.lg, marginTop: 40 },
  title: { fontSize: 30, fontWeight: "800", color: COLORS.textMain, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, marginTop: 4 },
  formCard: {
    backgroundColor: COLORS.surface,
    marginTop: SPACING.xl,
    padding: SPACING.lg,
    borderRadius: RADII.xl,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: { fontSize: 13, color: COLORS.textMuted, marginTop: 8, marginBottom: 6, fontWeight: "600" },
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
  error: { color: COLORS.error, marginTop: 12, fontSize: 13 },
  submitBtn: {
    marginTop: SPACING.lg,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADII.lg,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
  
  // Naye styles link ke liye
  registerLinkWrap: {
    marginTop: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  registerLinkText: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  registerLinkAction: {
    color: COLORS.primary,
    fontWeight: "700",
  },
});