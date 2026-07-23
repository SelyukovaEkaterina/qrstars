import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { QRPreview } from "@/components/qr-preview";
import { Spacing } from "@/constants/theme";
import { DEFAULT_QR_CONFIG } from "@/qr/presets";
import { type ApiQrCode, fetchMyQrCodes, updateQrCode, API_BASE_URL } from "@/api/client";

export default function CodeEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [qr, setQr] = useState<ApiQrCode | null>(null);
  const [label, setLabel] = useState("");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await fetchMyQrCodes();
      const found = data.qrcodes.find((q) => q.id === id);
      if (found) {
        setQr(found);
        setLabel(found.label || "");
        setRedirectUrl(found.redirectUrl || "");
        setIsActive(found.isActive);
      }
    } catch (e) {
      Alert.alert("Ошибка", String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateQrCode(id!, { label, redirectUrl, isActive });
      Alert.alert("Сохранено", "Изменения применены");
      load();
    } catch (e) {
      Alert.alert("Ошибка", String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveQrImage() {
    if (!qr) return;
    setSaving(true);
    try {
      const scanUrl = `${API_BASE_URL}/q/${qr.code}`;
      const { saveQrToGallery } = require("@/qr/save");
      const res = await saveQrToGallery(
        { ...DEFAULT_QR_CONFIG, dotStyle: "rounded", eyeStyle: "rounded" },
        scanUrl,
      );
      if (res.ok && res.message) Alert.alert("Готово", res.message);
      else if (!res.ok) Alert.alert("Не получилось", res.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleShare() {
    if (!qr) return;
    const scanUrl = `${API_BASE_URL}/q/${qr.code}`;
    try {
      await Share.share({ message: `${qr.label || "QR-код"}: ${scanUrl}` });
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
      </ThemedView>
    );
  }

  if (!qr) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText>QR-код не найден</ThemedText>
        <Pressable onPress={() => router.back()}>
          <ThemedText type="linkPrimary">Назад</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  const scanUrl = `${API_BASE_URL}/q/${qr.code}`;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.navBar}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color="#4f46e5" />
          </Pressable>
          <ThemedText type="smallBold">Редактирование</ThemedText>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.three, paddingBottom: 120 }}>
          <View style={styles.previewWrap}>
            <View style={styles.previewCard}>
              <QRPreview
                config={{ ...DEFAULT_QR_CONFIG, dotStyle: "rounded", eyeStyle: "rounded" }}
                payload={scanUrl}
                maxWidth={240}
              />
            </View>
          </View>

          <View style={styles.scanUrlBox}>
            <ThemedText style={{ fontSize: 11, opacity: 0.5 }}>Ссылка QR-кда</ThemedText>
            <ThemedText type="code" style={{ fontSize: 13 }} numberOfLines={1}>
              {scanUrl}
            </ThemedText>
          </View>

          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <ThemedText style={styles.statValue}>{qr.scansCount}</ThemedText>
              <ThemedText style={styles.statLabel}>сканов</ThemedText>
            </View>
            <View style={styles.statBox}>
              <ThemedText style={styles.statValue}>{qr.mode}</ThemedText>
              <ThemedText style={styles.statLabel}>режим</ThemedText>
            </View>
          </View>

          <ThemedText type="smallBold" style={styles.fieldLabel}>Название</ThemedText>
          <TextInput
            style={styles.input}
            value={label}
            onChangeText={setLabel}
            placeholder="Название QR-кода"
            placeholderTextColor="#999"
          />

          <ThemedText type="smallBold" style={styles.fieldLabel}>
            Адрес перенаправления
          </ThemedText>
          <TextInput
            style={styles.input}
            value={redirectUrl}
            onChangeText={setRedirectUrl}
            placeholder="https://..."
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <ThemedText style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>
            Гость сканирует QR → переходит сюда. Можно менять в любой момент — печатать заново не нужно.
          </ThemedText>

          <Pressable
            style={[styles.toggleRow, isActive && styles.toggleRowActive]}
            onPress={() => setIsActive(!isActive)}
          >
            <Ionicons
              name={isActive ? "checkmark-circle" : "ellipse-outline"}
              size={24}
              color={isActive ? "#059669" : "#999"}
            />
            <ThemedText type="small" style={{ marginLeft: 8 }}>
              {isActive ? "Активен (доступен для сканирования)" : "Отключён"}
            </ThemedText>
          </Pressable>

          <View style={styles.actionRow}>
            <Pressable style={styles.actionBtn} onPress={handleSaveQrImage}>
              <Ionicons name="download-outline" size={20} color="#4f46e5" />
              <ThemedText style={{ fontSize: 12, marginLeft: 4 }}>В галерею</ThemedText>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={20} color="#4f46e5" />
              <ThemedText style={{ fontSize: 12, marginLeft: 4 }}>Ссылка</ThemedText>
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.bottomBar}>
          <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText type="smallBold" style={{ color: "#fff" }}>
                Сохранить
              </ThemedText>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  previewWrap: { alignItems: "center", paddingVertical: Spacing.three },
  previewCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, elevation: 3, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  scanUrlBox: { backgroundColor: "rgba(128,128,128,0.08)", borderRadius: 8, padding: 10, gap: 2 },
  statRow: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.three },
  statBox: { flex: 1, backgroundColor: "rgba(128,128,128,0.08)", borderRadius: 10, padding: 14, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, opacity: 0.5 },
  fieldLabel: { marginTop: Spacing.three, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: "rgba(128,128,128,0.3)", borderRadius: 10, paddingHorizontal: 14, height: 48, fontSize: 16, color: "#000", backgroundColor: "rgba(255,255,255,0.5)" },
  toggleRow: { flexDirection: "row", alignItems: "center", marginTop: Spacing.three, padding: 14, borderRadius: 10, backgroundColor: "rgba(128,128,128,0.08)" },
  toggleRowActive: { backgroundColor: "rgba(5,150,105,0.08)" },
  actionRow: { flexDirection: "row", gap: Spacing.two, marginTop: Spacing.three },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: "rgba(79,70,229,0.3)" },
  bottomBar: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, backgroundColor: "rgba(255,255,255,0.95)", borderTopWidth: 1, borderTopColor: "rgba(128,128,128,0.15)" },
  saveBtn: { backgroundColor: "#4f46e5", height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
