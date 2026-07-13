import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from "react-native";
import ScreenHeader from "@/src/components/ScreenHeader";
import Badge from "@/src/components/Badge";
import { api } from "@/src/lib/api";
import { useAuth } from "@/src/lib/AuthContext";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";
import { Ionicons } from "@expo/vector-icons";

export default function FeesScreen() {
  const { user } = useAuth();
  const { t } = useLang();
  const [fees, setFees] = useState<any[]>([]);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<any | null>(null);

  const studentId =
    user?.role === "student"
      ? user.user_id
      : user?.role === "parent" && user.child_ids?.length
      ? user.child_ids[0]
      : null;

  const load = useCallback(async () => {
    if (!studentId) return;
    const res = await api.get(`/fees/student/${studentId}`);
    setFees(res);
  }, [studentId]);

  useEffect(() => {
    load();
  }, [load]);

  // ⚡ NEW: Load Razorpay Checkout Web Script Frame Library dynamically
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // 💳 Razorpay Web Payment Trigger Integration Engine
  async function pay(fee: any) {
    setPayingId(fee.fee_id);
    try {
      // 1. Script injection ensure karein
      const isScriptLoaded = await loadRazorpayScript();
      if (!isScriptLoaded) {
        alert("Failed to load payment gateway checkout script!");
        setPayingId(null);
        return;
      }

      // 2. Backend se Order ID create karwayenge via Secure Endpoint
      const orderData = await api.post("/fees/razorpay/create-order", { fee_id: fee.fee_id });
      if (!orderData || !orderData.order_id) {
        alert("Failed to create secure transaction order!");
        setPayingId(null);
        return;
      }

      // 3. Razorpay Options Bundle configuration setup
      const options = {
        key: orderData.key_id, // backend variable matching securely
        amount: orderData.amount * 100,
        currency: orderData.currency,
        name: "Saini Public School",
        description: orderData.title,
        order_id: orderData.order_id,
        handler: async function (response: any) {
          // Trigger hotay hi loading engine toggle set rakhenge dashboard par
          setPayingId(fee.fee_id);
          try {
            // 4. Verification payload backend me send karke data check sync commit karenge
            const verificationPayload = {
              fee_id: fee.fee_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            };

            const verifyResult = await api.post("/fees/razorpay/verify", verificationPayload);
            
            if (verifyResult && verifyResult.ok) {
              setReceipt({
                title: fee.title,
                amount: fee.amount,
                receipt_id: verifyResult.receipt_id,
              });
              await load();
            } else {
              alert("Payment verification rejected by server!");
            }
          } catch (err) {
            alert("Error verifying payment tokens!");
          } finally {
            setPayingId(null);
          }
        },
        prefill: {
          name: user?.name || "Student User",
          email: user?.email || "student@school.com",
        },
        theme: {
          color: COLORS.primary, // App primary brand identity matching color system standard
        },
        modal: {
          ondismiss: function () {
            setPayingId(null);
          }
        }
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.open();

    } catch (e: any) {
      alert("Payment window initialization failed.");
      setPayingId(null);
    }
  }

  const pending = fees.filter((f) => f.status === "pending");
  const paid = fees.filter((f) => f.status === "paid");
  const totalPending = pending.reduce((s, f) => s + f.amount, 0);

  return (
    <ScreenHeader title={t("fees")} showBack>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Total {t("pending")}</Text>
          <Text style={styles.summaryValue}>₹{totalPending.toLocaleString()}</Text>
          <Text style={styles.summarySub}>{pending.length} due</Text>
        </View>

        {pending.length > 0 && (
          <>
            <Text style={styles.h}>Pending</Text>
            {pending.map((f) => (
              <View key={f.fee_id} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{f.title}</Text>
                  <Text style={styles.meta}>Due {f.due_date}</Text>
                  <Text style={styles.amount}>₹{f.amount.toLocaleString()}</Text>
                </View>
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={() => pay(f)}
                  disabled={payingId !== null}
                >
                  {payingId === f.fee_id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.payText}>{t("pay_now")}</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </>
        )}

        {paid.length > 0 && (
          <>
            <Text style={styles.h}>Paid</Text>
            {paid.map((f) => (
              <View key={f.fee_id} style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{f.title}</Text>
                  <Text style={styles.meta}>Receipt: {f.receipt_id}</Text>
                  <Text style={styles.amount}>₹{f.amount.toLocaleString()}</Text>
                </View>
                <Badge label={t("paid").toUpperCase()} variant="success" />
              </View>
            ))}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={!!receipt} transparent animationType="fade" onRequestClose={() => setReceipt(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.receiptIcon}>
              <Ionicons name="checkmark-circle" size={60} color={COLORS.success} />
            </View>
            <Text style={styles.modalTitle}>Payment Successful!</Text>
            <Text style={styles.modalBody}>{receipt?.title}</Text>
            <Text style={styles.modalAmount}>₹{receipt?.amount?.toLocaleString()}</Text>
            <View style={styles.receiptBox}>
              <Text style={styles.receiptLabel}>Receipt ID</Text>
              <Text style={styles.receiptId}>{receipt?.receipt_id}</Text>
            </View>
            <TouchableOpacity style={styles.modalBtn} onPress={() => setReceipt(null)}>
              <Text style={styles.modalBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenHeader>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, gap: 10 },
  summary: {
    backgroundColor: COLORS.terracotta,
    padding: SPACING.xl,
    borderRadius: RADII.xl,
    alignItems: "flex-start",
    gap: 4,
  },
  summaryLabel: { color: "rgba(255,255,255,0.9)", fontSize: 13, fontWeight: "600" },
  summaryValue: { color: "#fff", fontSize: 34, fontWeight: "800", letterSpacing: -1 },
  summarySub: { color: "rgba(255,255,255,0.85)", fontSize: 13 },
  h: { fontSize: 13, fontWeight: "800", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginTop: 12 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: COLORS.surface,
    padding: SPACING.lg,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { fontSize: 15, fontWeight: "800", color: COLORS.textMain },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  amount: { fontSize: 20, fontWeight: "800", color: COLORS.textMain, marginTop: 6 },
  payBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: RADII.lg,
  },
  payText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: {
    backgroundColor: COLORS.surface, padding: SPACING.xl, borderRadius: RADII.xl, alignItems: "center",
    gap: 8, width: "100%", maxWidth: 340,
  },
  receiptIcon: { marginBottom: 8 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: COLORS.textMain },
  modalBody: { fontSize: 14, color: COLORS.textMuted },
  modalAmount: { fontSize: 28, fontWeight: "800", color: COLORS.primary, marginTop: 4 },
  receiptBox: {
    marginTop: 12, backgroundColor: COLORS.bg, padding: 12, borderRadius: RADII.md,
    width: "100%", alignItems: "center", borderStyle: "dashed", borderWidth: 1, borderColor: COLORS.border,
  },
  receiptLabel: { fontSize: 11, color: COLORS.textMuted, letterSpacing: 1, textTransform: "uppercase" },
  receiptId: { fontSize: 15, fontWeight: "800", color: COLORS.textMain, marginTop: 4 },
  modalBtn: { marginTop: 16, backgroundColor: COLORS.primary, paddingHorizontal: 32, paddingVertical: 12, borderRadius: RADII.lg, width: "100%", alignItems: "center" },
  modalBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});