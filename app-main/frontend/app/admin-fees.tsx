import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Modal,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "@/src/components/ScreenHeader";
import Badge from "@/src/components/Badge";
import { api } from "@/src/lib/api";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";

type FilterKey = "all" | "pending" | "paid";

interface StudentFee {
  student_id: string;
  name: string;
  roll_no: string | null;
  class_id: string | null;
  email: string;
  guardian_phone: string | null;
  status: "paid" | "pending";
  paid_amount: number;
  pending_amount: number;
  paid_count: number;
  pending_count: number;
  fees: any[];
}

interface Overview {
  summary: {
    total_students: number;
    fully_paid: number;
    has_pending: number;
    total_paid_amount: number;
    total_pending_amount: number;
  };
  students: StudentFee[];
}

const CLASSES_LIST = Array.from({ length: 12 }, (_, i) => `${i + 1}`);

export default function AdminFeesScreen() {
  const { t } = useLang();
  const [data, setData] = useState<Overview | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<StudentFee | null>(null);

  // Dynamic Structure Management UI States
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [feeStructures, setFeeStructures] = useState<Record<string, number>>({});
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [updatingStructure, setUpdatingStructure] = useState(false);

  const load = useCallback(async () => {
    try {
      const [resOverview, resStructure] = await Promise.all([
        api.get<Overview>("/fees/overview"),
        api.get<any[]>("/fees-structure").catch(() => []),
      ]);

      setData(resOverview);

      // Backend schemas mapped structures mapping matrix
      const structMap: Record<string, number> = {};
      CLASSES_LIST.forEach((c) => {
        structMap[c] = 5000; // Default safety price
      });
      if (Array.isArray(resStructure)) {
        resStructure.forEach((item) => {
          if (item.class_id) structMap[item.class_id] = item.amount;
        });
      }
      setFeeStructures(structMap);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleUpdateStructure = async (classId: string) => {
    const amt = parseFloat(editAmount);
    if (isNaN(amt) || amt < 0) return;
    setUpdatingStructure(true);
    try {
      await api.post("/admin/fees-structure", { class_id: classId, amount: amt });
      setFeeStructures((prev) => ({ ...prev, [classId]: amt }));
      setEditingClass(null);
      setEditAmount("");
      await load(); // Fresh calculation updates load karne ke liye
    } catch {
    } finally {
      setUpdatingStructure(false);
    }
  };

  const students = (data?.students ?? []).filter((s) => {
    if (filter === "pending" && s.status !== "pending") return false;
    if (filter === "paid" && s.status !== "paid") return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.roll_no ?? "").toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <ScreenHeader title="Fees Overview" subtitle="Student-wise status" showBack>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        {/* Dynamic Class Structures Setup CTA Trigger */}
        <TouchableOpacity 
          style={styles.manageStructureBtn}
          onPress={() => setShowStructureModal(true)}
        >
          <Ionicons name="settings-outline" size={18} color="#fff" />
          <Text style={styles.manageStructureBtnText}>Edit Class Fees Structure (1-12)</Text>
        </TouchableOpacity>

        {data && (
          <>
            {/* Summary Row */}
            <View style={styles.summaryRow}>
              <SummaryTile
                color={COLORS.success}
                bg="#E6F7EF"
                icon="checkmark-circle"
                value={data.summary.fully_paid}
                label="Fully Paid"
              />
              <SummaryTile
                color={COLORS.error}
                bg="#FDECEC"
                icon="alert-circle"
                value={data.summary.has_pending}
                label="Has Pending"
              />
              <SummaryTile
                color={COLORS.primary}
                bg={COLORS.chipBg}
                icon="people"
                value={data.summary.total_students}
                label="Total Students"
              />
            </View>

            {/* Amount Row */}
            <View style={styles.amountRow}>
              <View style={[styles.amountBox, { backgroundColor: COLORS.success }]}>
                <Text style={styles.amountLabel}>Collected</Text>
                <Text style={styles.amountValue}>₹{data.summary.total_paid_amount.toLocaleString()}</Text>
              </View>
              <View style={[styles.amountBox, { backgroundColor: COLORS.terracotta }]}>
                <Text style={styles.amountLabel}>Pending</Text>
                <Text style={styles.amountValue}>₹{data.summary.total_pending_amount.toLocaleString()}</Text>
              </View>
            </View>

            {/* Search */}
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color={COLORS.textMuted} />
              <TextInput
                style={styles.search}
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name, roll no, or email"
                placeholderTextColor={COLORS.textMuted}
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch("")}>
                  <Ionicons name="close-circle" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Filter chips */}
            <View style={styles.filterRow}>
              {(["all", "pending", "paid"] as FilterKey[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.chip, filter === f && styles.chipActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                    {f === "all" ? `All (${data.summary.total_students})` : f === "pending" ? `Pending (${data.summary.has_pending})` : `Paid (${data.summary.fully_paid})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* List */}
            {students.length === 0 && (
              <Text style={styles.empty}>{t("no_data")}</Text>
            )}
            {students.map((s) => (
              <TouchableOpacity
                key={s.student_id}
                style={styles.card}
                onPress={() => setSelected(s)}
                activeOpacity={0.85}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.avatar, s.status === "paid" ? { backgroundColor: "#E6F7EF" } : { backgroundColor: "#FDECEC" }]}>
                    <Text style={[styles.avatarText, { color: s.status === "paid" ? COLORS.success : COLORS.error }]}>
                      {s.name.slice(0, 1)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.name}>{s.name}</Text>
                      <Badge
                        label={s.status === "paid" ? "PAID" : "PENDING"}
                        variant={s.status === "paid" ? "success" : "error"}
                        small
                      />
                    </View>
                    <Text style={styles.meta}>
                      Roll No: <Text style={styles.rollValue}>{s.roll_no ?? "—"}</Text> • Class {s.class_id ?? "—"}
                    </Text>
                    <Text style={styles.metaSmall} numberOfLines={1}>{s.email}</Text>
                  </View>
                </View>

                <View style={styles.divider} />

                <View style={styles.amountsRow}>
                  <View style={styles.amountCol}>
                    <Text style={styles.amountColLabel}>Paid</Text>
                    <Text style={[styles.amountColValue, { color: COLORS.success }]}>
                      ₹{s.paid_amount.toLocaleString()}
                    </Text>
                    <Text style={styles.amountColCount}>{s.paid_count} item(s)</Text>
                  </View>
                  <View style={styles.vDivider} />
                  <View style={styles.amountCol}>
                    <Text style={styles.amountColLabel}>Pending</Text>
                    <Text
                      style={[
                        styles.amountColValue,
                        { color: s.pending_amount > 0 ? COLORS.error : COLORS.textMuted },
                      ]}
                    >
                      ₹{s.pending_amount.toLocaleString()}
                    </Text>
                    <Text style={styles.amountColCount}>{s.pending_count} item(s)</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
            <View style={{ height: 40 }} />
          </>
        )}
      </ScrollView>

      {/* 🔹 MASTER FEES STRUCTURE EDIT MODAL (CLASS 1 - 12) */}
      <Modal
        visible={showStructureModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStructureModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { maxHeight: "80%" }]}>
            <View style={styles.modalHead}>
              <Ionicons name="cash-outline" size={22} color={COLORS.primary} />
              <Text style={[styles.modalName, { flex: 1, marginLeft: 8 }]}>Classes Base Fees Config</Text>
              <TouchableOpacity onPress={() => { setShowStructureModal(false); setEditingClass(null); }}>
                <Ionicons name="close" size={24} color={COLORS.textMain} />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.structureInfoText}> Set base tuition fees value here. New students registering under these classes will instantly inherit these dynamic balance figures. </Text>

            <ScrollView contentContainerStyle={{ gap: 10, paddingVertical: 10 }}>
              {CLASSES_LIST.map((c) => {
                const isEditing = editingClass === c;
                return (
                  <View key={c} style={styles.structureCard}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.structureClassTitle}>Class {c}</Text>
                      {!isEditing && (
                        <Text style={styles.structureAmountText}>₹{(feeStructures[c] ?? 5000).toLocaleString()}</Text>
                      )}
                    </View>

                    {isEditing ? (
                      <View style={styles.editingWrapper}>
                        <TextInput
                          style={styles.structureInput}
                          value={editAmount}
                          onChangeText={setEditAmount}
                          keyboardType="numeric"
                          placeholder="Amount"
                          autoFocus
                        />
                        <TouchableOpacity 
                          style={styles.saveInlineBtn} 
                          disabled={updatingStructure}
                          onPress={() => handleUpdateStructure(c)}
                        >
                          {updatingStructure ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelInlineBtn} onPress={() => setEditingClass(null)}>
                          <Ionicons name="close" size={16} color={COLORS.textMain} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity 
                        style={styles.editInlineBtn}
                        onPress={() => {
                          setEditingClass(c);
                          setEditAmount((feeStructures[c] ?? 5000).toString());
                        }}
                      >
                        <Ionicons name="pencil" size={14} color={COLORS.primary} />
                        <Text style={styles.editInlineBtnText}>Edit</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Student individual detail modal */}
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <View style={styles.modalAvatar}>
                <Text style={styles.modalAvatarText}>{selected?.name.slice(0, 1)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalName}>{selected?.name}</Text>
                <Text style={styles.modalRoll}>Roll {selected?.roll_no} • Class {selected?.class_id ?? "—"}</Text>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Ionicons name="close" size={24} color={COLORS.textMain} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContact}>
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => selected?.guardian_phone && Linking.openURL(`tel:${selected.guardian_phone}`)}
              >
                <Ionicons name="call" size={16} color={COLORS.primary} />
                <Text style={styles.contactText}>{selected?.guardian_phone ?? "—"}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.contactBtn}
                onPress={() => selected?.email && Linking.openURL(`mailto:${selected.email}`)}
              >
                <Ionicons name="mail" size={16} color={COLORS.primary} />
                <Text style={styles.contactText} numberOfLines={1}>{selected?.email}</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 340 }} contentContainerStyle={{ gap: 8 }}>
              {selected?.fees.map((f: any) => (
                <View key={f.fee_id} style={styles.feeRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.feeTitle}>{f.title}</Text>
                    <Text style={styles.feeDue}>
                      {f.status === "paid" ? `Paid ${f.paid_at?.slice(0, 10)}` : `Due ${f.due_date ?? "—"}`}
                    </Text>
                    {f.receipt_id ? <Text style={styles.feeReceipt}>{f.receipt_id}</Text> : null}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={styles.feeAmount}>₹{f.amount.toLocaleString()}</Text>
                    <Badge
                      label={f.status.toUpperCase()}
                      variant={f.status === "paid" ? "success" : "error"}
                      small
                    />
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenHeader>
  );
}

function SummaryTile({ color, bg, icon, value, label }: { color: string; bg: string; icon: any; value: number; label: string }) {
  return (
    <View style={[styles.sumTile, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.sumValue, { color }]}>{value}</Text>
      <Text style={styles.sumLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: SPACING.lg, gap: 12 },
  manageStructureBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.primary, paddingVertical: 12, borderRadius: RADII.lg,
    marginBottom: 4
  },
  manageStructureBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  summaryRow: { flexDirection: "row", gap: 8 },
  sumTile: { flex: 1, padding: 12, borderRadius: RADII.lg, alignItems: "center", gap: 4 },
  sumValue: { fontSize: 22, fontWeight: "800" },
  sumLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600", textAlign: "center" },

  amountRow: { flexDirection: "row", gap: 10 },
  amountBox: { flex: 1, padding: SPACING.lg, borderRadius: RADII.lg, gap: 4 },
  amountLabel: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" },
  amountValue: { color: "#fff", fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },

  searchWrap: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: COLORS.surface, borderRadius: RADII.lg,
    paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border, height: 44,
  },
  search: { flex: 1, fontSize: 14, color: COLORS.textMain },

  filterRow: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1, height: 36, borderRadius: 999, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center",
  },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 12, fontWeight: "700", color: COLORS.textMain },
  chipTextActive: { color: "#fff" },

  empty: { textAlign: "center", color: COLORS.textMuted, marginTop: 40 },

  card: {
    backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: RADII.xl,
    borderWidth: 1, borderColor: COLORS.border, gap: 12,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontWeight: "800" },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  name: { fontSize: 16, fontWeight: "800", color: COLORS.textMain, flex: 1 },
  meta: { fontSize: 12, color: COLORS.textMuted, marginTop: 4 },
  rollValue: { color: COLORS.primary, fontWeight: "800" },
  metaSmall: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },

  divider: { height: 1, backgroundColor: COLORS.border },

  amountsRow: { flexDirection: "row", alignItems: "center" },
  amountCol: { flex: 1, alignItems: "center", gap: 2 },
  amountColLabel: { fontSize: 11, color: COLORS.textMuted, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  amountColValue: { fontSize: 18, fontWeight: "800", marginTop: 2 },
  amountColCount: { fontSize: 11, color: COLORS.textMuted },
  vDivider: { width: 1, height: 40, backgroundColor: COLORS.border },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.lg, gap: 12, maxHeight: "85%",
  },
  modalHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  modalAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  modalAvatarText: { color: "#fff", fontSize: 22, fontWeight: "800" },
  modalName: { fontSize: 18, fontWeight: "800", color: COLORS.textMain },
  modalRoll: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  modalContact: { flexDirection: "row", gap: 8 },
  contactBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: COLORS.chipBg, paddingHorizontal: 12, paddingVertical: 10, borderRadius: RADII.md,
  },
  contactText: { color: COLORS.primary, fontSize: 12, fontWeight: "700", flex: 1 },

  feeRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: COLORS.bg, padding: 12, borderRadius: RADII.md,
    borderWidth: 1, borderColor: COLORS.border,
  },
  feeTitle: { fontSize: 13, fontWeight: "700", color: COLORS.textMain },
  feeDue: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  feeReceipt: { fontSize: 10, color: COLORS.primary, marginTop: 2, fontWeight: "700" },
  feeAmount: { fontSize: 14, fontWeight: "800", color: COLORS.textMain, marginBottom: 4 },

  structureInfoText: { fontSize: 12, color: COLORS.textMuted, lineHeight: 16, marginTop: 2 },
  structureCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.bg, padding: 14, borderRadius: RADII.lg,
    borderWidth: 1, borderColor: COLORS.border
  },
  structureClassTitle: { fontSize: 14, fontWeight: "800", color: COLORS.textMain },
  structureAmountText: { fontSize: 15, fontWeight: "700", color: COLORS.primary, marginTop: 2 },
  editingWrapper: { flexDirection: "row", alignItems: "center", gap: 6 },
  structureInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADII.md,
    paddingHorizontal: 8, height: 36, width: 80, fontSize: 14, color: COLORS.textMain,
    backgroundColor: COLORS.surface
  },
  saveInlineBtn: {
    width: 36, height: 36, borderRadius: RADII.md, backgroundColor: COLORS.success,
    alignItems: "center", justifyContent: "center"
  },
  cancelInlineBtn: {
    width: 36, height: 36, borderRadius: RADII.md, backgroundColor: COLORS.surface,
    borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "center"
  },
  editInlineBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: COLORS.primary + "33", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: RADII.md, backgroundColor: COLORS.chipBg
  },
  editInlineBtnText: { fontSize: 12, color: COLORS.primary, fontWeight: "700" }
});