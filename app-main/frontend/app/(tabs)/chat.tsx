import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { api } from "@/src/lib/api";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS_EN = [
  "What are school timings?",
  "Tell me about the uniform",
  "How do I raise a leave request?",
  "When is the next PTM?",
];

const SUGGESTIONS_HI = [
  "School timings kya hain?",
  "Uniform ke baare me batao",
  "Leave request kaise dalein?",
  "Agli PTM kab hai?",
];

export default function ChatScreen() {
  const { t, lang } = useLang();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const sessionRef = useRef<string>(`s_${Date.now()}`);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setMessages([
      {
        role: "assistant",
        content:
          lang === "hi"
            ? "Namaste! Main SchoolBot hoon. School ke baare me kuch bhi poochhein — timings, uniform, fees, homework, ya padhai ke tips."
            : "Hi! I'm SchoolBot. Ask me anything about the school — timings, uniform, fees, homework, or study tips.",
      },
    ]);
  }, [lang]);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await api.get<any>(`/chatbot/history/${sessionRef.current}`);
        if (res && res.status === "success" && Array.isArray(res.history) && res.history.length > 0) {
          const mappedMsgs = res.history.map((h: any) => ({
            role: h.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: h.content,
          }));
          setMessages(mappedMsgs);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
        }
      } catch (err) {
        console.log("No previous history found.");
      }
    }
    fetchHistory();
  }, []);

async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || sending) return;
    
    setInput("");
    const newMsgs = [...messages, { role: "user" as const, content: msg }];
    setMessages(newMsgs);
    setSending(true);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    
    try {
      // API request pipeline execution
      const res = await api.post<any>("/chatbot", {
        session_id: sessionRef.current,
        message: msg,
        language: lang,
      });
      
      // Strict standard format lookup response mapper
      if (res && res.reply) {
        setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
      } else if (res && typeof res === "string") {
        setMessages((m) => [...m, { role: "assistant", content: res }]);
      } else {
        throw new Error("Formatting structural integrity broke");
      }
    } catch (e: any) {
      setMessages((m) => [
        ...m,
        { 
          role: "assistant", 
          content: lang === "hi" 
            ? "Main abhi is query ka output fetch nahi kar paaya. Kripya ek baar aur koshish karein." 
            : "Sorry, I'm having trouble right now. Please try again." 
        },
      ]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  const suggestions = lang === "hi" ? SUGGESTIONS_HI : SUGGESTIONS_EN;

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.mainContainer}>
        
        {/* HEADER BLOCK */}
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t("ai_chatbot")}</Text>
            <Text style={styles.subtitle}>SchoolBot • Powered by Gemini AI</Text>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
        >
          {/* MESSAGES VIEWPORT */}
          <ScrollView
            ref={scrollRef}
            style={{ flex: 1 }}
            contentContainerStyle={styles.messages}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((m, i) => (
              <View
                key={i}
                style={[
                  styles.bubbleContainer,
                  m.role === "user" ? styles.userContainer : styles.botContainer
                ]}
              >
                <View style={[styles.bubble, m.role === "user" ? styles.userBubble : styles.botBubble]}>
                  {m.role === "assistant" && (
                    <Ionicons name="sparkles" size={12} color={COLORS.primary} style={{ marginBottom: 6 }} />
                  )}
                  <Text style={m.role === "user" ? styles.userText : styles.botText}>{m.content}</Text>
                </View>
              </View>
            ))}
            {sending && (
              <View style={[styles.bubbleContainer, styles.botContainer]}>
                <View style={[styles.bubble, styles.botBubble, { paddingVertical: 16 }]}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              </View>
            )}
          </ScrollView>

          {/* ⚡ FIXED: QUICK SUGGESTIONS WRAPPED BLOCK (Ab screen se bahar bilkul nahi jayega) */}
          {messages.length <= 1 && (
            <View style={styles.suggestionsContainer}>
              <View style={styles.suggestRow}>
                {suggestions.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggestChip}
                    onPress={() => send(s)}
                  >
                    <Text style={styles.suggestText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* INPUT BAR */}
          <View style={styles.inputOuterRow}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder={t("ask_anything")}
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !input.trim() && { opacity: 0.5 }]}
              onPress={() => send()}
              disabled={!input.trim() || sending}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>

      </View>
    </SafeAreaView>
  );
}

const isWebLaptop = Platform.OS === "web" && Dimensions.get("window").width > 768;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  mainContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
    width: "100%",
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
    width: "100%",
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "800", color: COLORS.textMain },
  subtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  
  messages: { 
    padding: SPACING.lg, 
    gap: 14,
  },
  bubbleContainer: {
    width: "100%",
    flexDirection: "row",
    marginVertical: 2,
  },
  userContainer: { justifyContent: "flex-end" },
  botContainer: { justifyContent: "flex-start" },
  
  bubble: {
    padding: 12,
    borderRadius: RADII.lg,
    maxWidth: "85%",
  },
  userBubble: { 
    alignSelf: "flex-end", 
    backgroundColor: COLORS.primary, 
    borderBottomRightRadius: 4,
  },
  botBubble: { 
    alignSelf: "flex-start", 
    backgroundColor: "#F8FAFC", 
    borderWidth: 1, 
    borderColor: COLORS.border, 
    borderBottomLeftRadius: 4,
  },
  userText: { color: "#fff", fontSize: 15, lineHeight: 22 },
  botText: { color: COLORS.textMain, fontSize: 15, lineHeight: 22 },
  
  // ⚡ STRATEGIC REFIX: Pura flexible view width constraint lagaya
  suggestionsContainer: {
    width: "100%",
    paddingHorizontal: SPACING.md,
    marginBottom: 6,
  },
  suggestRow: { 
    flexDirection: "row",
    flexWrap: "wrap", //  Phone par aate hi buttons ek ke niche ek automatic wrap ho jayenge!
    gap: 8, 
    justifyContent: isWebLaptop ? "flex-start" : "center", // Mobile me beech me perfectly alignment dega
  },
  suggestChip: {
    backgroundColor: COLORS.chipBg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADII.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestText: { color: COLORS.primary, fontSize: 13, fontWeight: "600", textAlign: "center" },
  
  inputOuterRow: { 
    flexDirection: "row", 
    alignItems: "flex-end", 
    padding: SPACING.md, 
    gap: 10, 
    width: "100%",
    borderTopWidth: 1, 
    borderTopColor: COLORS.border, 
    backgroundColor: COLORS.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.textMain,
    backgroundColor: "#FAFAF9",
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
  },
});