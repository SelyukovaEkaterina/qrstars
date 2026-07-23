import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useAuthStore } from "@/store/auth";
import { type ApiQrCode, fetchMyQrCodes, createDynamicQr } from "@/api/client";

export default function MyCodesScreen() {
  const { isAuthenticated } = useAuthStore();
  const [codes, setCodes] = useState<ApiQrCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchMyQrCodes();
      setCodes(data.qrcodes);
    } catch (e) {
      Alert.alert("Ошибка", String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else setLoading(false);
  }, [isAuthenticated, load]);

  if (!isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centerArea}>
          <Ionicons name="lock-closed-outline" size={48} color="#999" />
          <ThemedText type="subtitle" style={styles.emptyTitle}>
            Войдите в аккаунт
          </ThemedText>
          <ThemedText type="small" style={{ opacity: 0.6, textAlign: "center" }}>
            Авторизуйтесь, чтобы создавать и управлять динамическими QR-кодами
          </ThemedText>
          <Pressable style={styles.loginBtn} onPress={() => router.push("/login")}>
            <ThemedText type="smallBold" style={{ color: "#fff" }}>
              Войти
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  async function handleCreate() {
    try {
      const result = await createDynamicQr({ label: "Новый QR", redirectUrl: "https://" });
      Alert.alert("Создан", `Код: ${result.qrcode.code}`);
      load();
    } catch (e) {
      Alert.alert("Ошибка", String(e));
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.headerRow}>
          <ThemedText type="title" style={styles.title}>
            Мои коды
          </ThemedText>
          <Pressable style={styles.addBtn} onPress={handleCreate}>
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>

        <FlatList
          data={codes}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={{ paddingHorizontal: Spacing.three, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/(tabs)/my-codes/${item.id}`)}
            >
              <View style={styles.cardTop}>
                <ThemedText type="smallBold" numberOfLines={1} style={{ flex: 1 }}>
                  {item.label || item.code}
                </ThemedText>
                <View style={[styles.badge, item.isActive ? styles.badgeActive : styles.badgeInactive]}>
                  <ThemedText style={{ fontSize: 10, color: item.isActive ? "#059669" : "#999" }}>
                    {item.isActive ? "Активен" : "Выкл"}
                  </ThemedText>
                </View>
              </View>
              <ThemedText type="small" style={{ opacity: 0.5 }} numberOfLines={1}>
                {item.redirectUrl || `/${item.code}`}
              </ThemedText>
              <View style={styles.cardBottom}>
                <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>
                  {item.mode === "REDIRECT" ? "Редирект" : item.mode}
                </ThemedText>
                <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>
                  {item.scansCount} сканов
                </ThemedText>
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyState}>
                <Ionicons name="qr-code-outline" size={48} color="#ccc" />
                <ThemedText type="small" style={{ opacity: 0.5, marginTop: 8 }}>
                  Нет QR-кодов. Нажмите + для создания.
                </ThemedText>
              </View>
            )
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  centerArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.five, gap: Spacing.two },
  emptyTitle: { fontSize: 24 },
  loginBtn: { backgroundColor: "#4f46e5", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, marginTop: Spacing.two },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  title: { fontSize: 28, lineHeight: 34 },
  addBtn: { backgroundColor: "#4f46e5", width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "rgba(128,128,128,0.08)", borderRadius: 12, padding: 14, gap: 4 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeActive: { backgroundColor: "rgba(5,150,105,0.12)" },
  badgeInactive: { backgroundColor: "rgba(128,128,128,0.12)" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  emptyState: { alignItems: "center", paddingTop: 60 },
});
