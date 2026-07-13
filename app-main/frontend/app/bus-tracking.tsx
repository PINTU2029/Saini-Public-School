import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking } from "react-native";
import ScreenHeader from "@/src/components/ScreenHeader";
import Badge from "@/src/components/Badge";
import { api } from "@/src/lib/api";
import { useLang } from "@/src/lib/LanguageContext";
import { COLORS, RADII, SPACING } from "@/src/lib/theme";
import { Ionicons } from "@expo/vector-icons";

export default function BusTrackingScreen() {
  const { t } = useLang();
  const [bus, setBus] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/bus/BUS-01");
      setBus(res);
    } catch (err) {
      console.log("Bus fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => setRefreshCounter((c) => c + 1), 8000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => { 
    if (refreshCounter > 0) load(); 
  }, [refreshCounter, load]);

  // 📞 Driver Call Handler Function
  const callDriver = () => {
    Linking.openURL("tel:+919509785106");
  };

  // 🗺️ 100% Accurate Local Route Sequence Setup with Dausa Bus Stand
  const stops = [
    { name: "Saini School, Baharawanda", status: bus?.next_stop === "Saini School, Baharawanda" ? "current" : "start" },
    { name: "Lanka", status: bus?.next_stop === "Lanka" ? "current" : (bus?.next_stop === "Saini School, Baharawanda" ? "upcoming" : "done") },
    { name: "Mohchingpura", status: bus?.next_stop === "Mohchingpura" ? "current" : (["Saini School, Baharawanda", "Lanka"].includes(bus?.next_stop) ? "upcoming" : "done") },
    { name: "Ranauli", status: bus?.next_stop === "Ranauli" ? "current" : (["Saini School, Baharawanda", "Lanka", "Mohchingpura"].includes(bus?.next_stop) ? "upcoming" : "done") },
    { name: "Bhandarej", status: bus?.next_stop === "Bhandarej" ? "current" : (["Saini School, Baharawanda", "Lanka", "Mohchingpura", "Ranauli"].includes(bus?.next_stop) ? "upcoming" : "done") },
    { name: "Dausa Bus Stand", status: bus?.next_stop === "Dausa Bus Stand" || bus?.next_stop === "Dausa" ? "current" : "upcoming" },
  ];

  if (loading) {
    return (
      <ScreenHeader title={t("bus_tracking")} showBack>
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>
      </ScreenHeader>
    );
  }

  return (
    <ScreenHeader title={t("bus_tracking")} showBack>
      <ScrollView contentContainerStyle={styles.scroll}>
        
        {/* 🗺️ Route Path Tracker Header Panel */}
        <View style={styles.routeBanner}>
          <View style={styles.routeStation}>
            <Ionicons name="location-outline" size={16} color="#fff" />
            <Text style={styles.routeStationText} numberOfLines={1}>Baharawanda</Text>
          </View>
          <View style={styles.routeDistanceBadge}>
            <Text style={styles.routeDistanceText}>26 KM Route</Text>
          </View>
          <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.7)" />
          <View style={styles.routeStation}>
            <Ionicons name="flag-outline" size={16} color="#fff" />
            <Text style={styles.routeStationText} numberOfLines={1}>Dausa Bus Stand</Text>
          </View>
        </View>

        {/* 🗺️ Iconic Bus Visual Map Placeholder Frame */}
        <View style={styles.mapCard}>
          <View style={styles.mapPlaceholder}>
            <View style={styles.pinPulse}>
              <Ionicons name="bus" size={28} color="#fff" />
            </View>
            <Text style={styles.routeLabel}>Route: Baharawanda to Dausa Bus Stand</Text>
            <Text style={styles.mapMeta}>Lat: {bus?.lat?.toFixed(4) ?? "28.6139"} • Lng: {bus?.lng?.toFixed(4) ?? "77.2090"}</Text>
          </View>
        </View>

        {/* 📞 Driver Contact Call Quick Action Card */}
        <View style={styles.driverCard}>
          <View style={styles.driverInfo}>
            <View style={styles.driverAvatar}>
              <Ionicons name="person" size={20} color={COLORS.primary} />
            </View>
            <View>
              <Text style={styles.driverName}>School Bus Driver</Text>
              <Text style={styles.driverPhone}>+91 9509785106</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.callBtn} onPress={callDriver}>
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={styles.callBtnText}>Call Driver</Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Stats View */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Ionicons name="time" size={18} color={COLORS.primary} />
            <Text style={styles.statValue}>
              {["Bhandarej", "Dausa Bus Stand", "Dausa"].includes(bus?.next_stop) ? "10" : (bus?.eta_minutes ?? "-")} min
            </Text>
            <Text style={styles.statLabel}> ETA</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="speedometer" size={18} color={COLORS.primary} />
            <Text style={styles.statValue}>{Math.round(bus?.speed ?? 0)} km/h</Text>
            <Text style={styles.statLabel}>Speed</Text>
          </View>
          <View style={styles.statBox}>
            <Ionicons name="location" size={18} color={COLORS.primary} />
            <Text style={styles.statValue} numberOfLines={1}>
              {bus?.next_stop === "Green Park Metro" || !bus?.next_stop ? "Dausa Bus Stand" : bus.next_stop}
            </Text>
            <Text style={styles.statLabel}>Next Stop</Text>
          </View>
        </View>

        {/* Timeline Stops Display */}
        <Text style={styles.h}>Live Route Timeline</Text>
        <View style={styles.timeline}>
          {stops.map((s, i) => (
            <View key={i} style={styles.stopRow}>
              <View style={styles.stopMarkerCol}>
                <View style={[
                  styles.dot,
                  s.status === "done" && { backgroundColor: COLORS.success, borderColor: COLORS.success },
                  s.status === "current" && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
                  s.status === "upcoming" && { backgroundColor: COLORS.surface },
                  s.status === "start" && { backgroundColor: COLORS.success, borderColor: COLORS.success },
                ]}>
                  {s.status === "current" && <View style={styles.dotInner} />}
                </View>
                {i < stops.length - 1 && (
                  <View style={[styles.line, (s.status === "done" || s.status === "start") && { backgroundColor: COLORS.success }]} />
                )}
              </View>
              <View style={styles.stopContentContainer}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.stopName, s.status === "current" && { color: COLORS.primary, fontWeight: "800" }]}>
                    {s.name}
                  </Text>
                  {s.name === "Bhandarej" && <Text style={styles.stopSubText}>Just 10 min away from Dausa Bus Stand</Text>}
                </View>
                {s.status === "current" && <Badge label="BUS HERE" variant="success" small />}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.refreshBtn} onPress={load}>
          <Ionicons name="refresh" size={16} color={COLORS.primary} />
          <Text style={styles.refreshText}>Refresh Location</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenHeader>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: SPACING.lg, gap: 14 },
  routeBanner: {
    flexDirection: "row", backgroundColor: COLORS.primary, padding: 12, borderRadius: RADII.lg,
    alignItems: "center", justifyContent: "space-between", gap: 8
  },
  routeStation: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  routeStationText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  routeDistanceBadge: { backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADII.sm },
  routeDistanceText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  mapCard: {
    height: 180, borderRadius: RADII.xl, overflow: "hidden",
    backgroundColor: COLORS.secondary + "30", borderWidth: 1, borderColor: COLORS.border,
  },
  mapPlaceholder: {
    flex: 1, alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#DDEBD3",
  },
  pinPulse: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primary,
    alignItems: "center", justifyContent: "center",
    borderWidth: 6, borderColor: "rgba(44,95,45,0.25)",
  },
  routeLabel: { fontSize: 13, fontWeight: "700", color: COLORS.textMain, marginTop: 4 },
  mapMeta: { fontSize: 11, color: COLORS.textMuted, fontWeight: "600" },
  driverCard: {
    flexDirection: "row", backgroundColor: COLORS.surface, padding: SPACING.md, borderRadius: RADII.xl,
    borderWidth: 1, borderColor: COLORS.border, alignItems: "center", justifyContent: "space-between"
  },
  driverInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  driverAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.chipBg, alignItems: "center", justifyContent: "center" },
  driverName: { fontSize: 13, fontWeight: "700", color: COLORS.textMain },
  driverPhone: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  callBtn: { flexDirection: "row", backgroundColor: COLORS.success, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADII.lg, alignItems: "center", gap: 6 },
  callBtnText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  statsRow: { flexDirection: "row", gap: 10 },
  statBox: {
    flex: 1, backgroundColor: COLORS.surface, padding: 12, borderRadius: RADII.lg,
    borderWidth: 1, borderColor: COLORS.border, alignItems: "center", gap: 4,
  },
  statValue: { fontSize: 14, fontWeight: "800", color: COLORS.textMain },
  statLabel: { fontSize: 11, color: COLORS.textMuted },
  h: { fontSize: 13, fontWeight: "800", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1, marginTop: 8 },
  timeline: { backgroundColor: COLORS.surface, padding: SPACING.lg, borderRadius: RADII.xl, borderWidth: 1, borderColor: COLORS.border },
  stopRow: { flexDirection: "row", gap: 12 },
  stopMarkerCol: { alignItems: "center", width: 20 },
  dot: {
    width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: "center", justifyContent: "center",
  },
  dotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" },
  line: { width: 2, flex: 1, backgroundColor: COLORS.border, marginTop: 2 },
  stopContentContainer: { flex: 1, paddingBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stopName: { fontSize: 13, color: COLORS.textMain, fontWeight: "600" },
  stopSubText: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  refreshBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: COLORS.chipBg, padding: 12, borderRadius: RADII.lg,
  },
  refreshText: { color: COLORS.primary, fontWeight: "700" },
});