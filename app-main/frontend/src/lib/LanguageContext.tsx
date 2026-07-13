import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { storage } from "@/src/utils/storage";

export type Lang = "en" | "hi";

type Dict = Record<string, { en: string; hi: string }>;

const DICT: Dict = {
  app_name: { en: "Vidya Sahaayak", hi: "विद्या सहायक" },
  tagline: { en: "Smart School. Happy Children.", hi: "स्मार्ट स्कूल। खुश बच्चे।" },
  login: { en: "Login", hi: "लॉगिन करें" },
  logout: { en: "Logout", hi: "लॉगआउट" },
  email: { en: "Email", hi: "ईमेल आईडी" },
  password: { en: "Password", hi: "पासवर्ड" },
  welcome: { en: "Welcome", hi: "स्वागत है" },
  home: { en: "Home", hi: "मुख्य पृष्ठ" },
  diary: { en: "Diary", hi: "डायरी" },
  chat: { en: "AI Chat", hi: "एआई चैट" },
  menu: { en: "Menu", hi: "मेन्यू" },
  attendance: { en: "Attendance", hi: "हाजिरी" },
  homework: { en: "Homework", hi: "गृहकार्य (होमवर्क)" },
  notices: { en: "Notices", hi: "सूचनाएं" },
  fees: { en: "Fees", hi: "फीस" },
  report_card: { en: "Report Card", hi: "प्रगति पत्र (रिपोर्ट कार्ड)" },
  timetable: { en: "Timetable", hi: "समय सारणी" },
  bus_tracking: { en: "Bus Tracking", hi: "बस ट्रैकिंग" },
  gallery: { en: "Photo Gallery", hi: "फोटो गैलरी" },
  lms: { en: "Learning Material", hi: "पढ़ाई सामग्री" },
  leaves: { en: "Leaves", hi: "छुट्टियां" },
  ai_chatbot: { en: "AI Assistant", hi: "एआई सहायक" },
  admin_broadcast: { en: "Broadcasts", hi: "सूचना भेजें" },
  mark_attendance: { en: "Mark Attendance", hi: "हाजिरी लगाएं" },
  post_homework: { en: "Post Homework", hi: "होमवर्क डालें" },
  pay_now: { en: "Pay Now", hi: "अभी भुगतान करें" },
  paid: { en: "Paid", hi: "भुगतान हो गया" },
  pending: { en: "Pending", hi: "बाकी है" },
  present: { en: "Present", hi: "उपस्थित" },
  absent: { en: "Absent", hi: "अनुपस्थित" },
  late: { en: "Late", hi: "देर से" },
  today: { en: "Today", hi: "आज" },
  overall: { en: "Overall", hi: "कुल" },
  loading: { en: "Loading…", hi: "लोड हो रहा है..." },
  save: { en: "Save", hi: "सुरक्षित करें" },
  submit: { en: "Submit", hi: "जमा करें" },
  cancel: { en: "Cancel", hi: "रद्द करें" },
  approve: { en: "Approve", hi: "मंजूर करें" },
  reject: { en: "Reject", hi: "नामंजूर करें" },
  send: { en: "Send", hi: "भेजें" },
  ask_anything: { en: "Ask anything about the school…", hi: "स्कूल के बारे में कुछ भी पूछें..." },
  language: { en: "Language", hi: "भाषा" },
  hindi: { en: "Hindi", hi: "हिंदी" },
  english: { en: "English", hi: "अंग्रेजी" },
  no_data: { en: "Nothing here yet.", hi: "अभी यहां कुछ नहीं है।" },

  // --- REGISTRATION & EXTRA AUTH KEYS (Jo pehle missing thhi) ---
  register: { en: "Register", hi: "पंजीकरण (रजिस्टर)" },
  create_account: { en: "Create Account", hi: "खाता बनाएं" },
  full_name: { en: "Full Name", hi: "पूरा नाम" },
  confirm_password: { en: "Confirm Password", hi: "पासवर्ड की पुष्टि करें" },
  select_role: { en: "Select Role", hi: "भूमिका चुनें" },
  dont_have_account: { en: "Don't have an account?", hi: "क्या आपका खाता नहीं है?" },
  already_have_account: { en: "Already have an account?", hi: "पहले से खाता है?" },
  register_here: { en: "Register here", hi: "यहाँ रजिस्टर करें" },
  login_here: { en: "Login", hi: "लॉगिन करें" },
  student: { en: "Student", hi: "छात्र (Student)" },
  teacher: { en: "Teacher", hi: "शिक्षक (Teacher)" },
  parent: { en: "Parent", hi: "अभिभावक (Parent)" },
  admin: { en: "Admin", hi: "एडमिन (Admin)" }
};

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof DICT) => string;
}

const LanguageContext = createContext<LangCtx>({
  lang: "en",
  setLang: () => {},
  t: (k) => DICT[k]?.en ?? String(k),
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    (async () => {
      const stored = await storage.getItem<string>("lang", "en");
      if (stored === "hi" || stored === "en") setLangState(stored);
    })();
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    storage.setItem("lang", l);
  }, []);

  const t = useCallback((key: keyof typeof DICT) => DICT[key]?.[lang] ?? String(key), [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
  );
}

export const useLang = () => useContext(LanguageContext);
