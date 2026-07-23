import { useEffect } from "react";
import { Pressable, StyleSheet, View, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useAuthStore } from "@/store/auth";

export default function AccountScreen() {
  const { isAuthenticated, user, logout, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!isAuthenticated) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.centerArea}>
          <Ionicons name="person-circle-outline" size={64} color="#999" />
          <ThemedText type="subtitle" style={{ fontSize: 22 }}>
            Вы не вошли
          </ThemedText>
          <ThemedText type="small" style={{ opacity: 0.6, textAlign: "center" }}>
            Войдите в аккаунт QrStars для создания динамических QR-кодов
          </ThemedText>
          <Pressable style={styles.loginBtn} onPress={() => router.push("/login")}>
            <Ionicons name="log-in-outline" size={20} color="#fff" />
            <ThemedText type="smallBold" style={{ color: "#fff", marginLeft: 8 }}>
              Войти
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </ThemedView>
    );
  }

  function handleLogout() {
    Alert.alert("Выход", "Выйти из аккаунта?", [
      { text: "Отмена", style: "cancel" },
      { text: "Выйти", style: "destructive", onPress: () => logout() },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>Профиль</ThemedText>

        <View style={styles.infoCard}>
            <Ionicons name="person-circle" size={56} color="#4f46e5" />
          <View style={{ flex: 1 }}>
            <ThemedText type="smallBold">{user?.name || user?.email}</ThemedText>
            {user?.name && (
              <ThemedText style={{ fontSize: 13, opacity: 0.5 }}>{user.email}</ThemedText>
            )}
            <View style={styles.roleBadge}>
              <ThemedText style={{ fontSize: 10, color: "#4f46e5" }}>
                {user?.role === "ADMIN" ? "Администратор" : "Владелец"}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={18} color="#999" />
          <ThemedText type="small" style={{ marginLeft: 10 }}>{user?.email}</ThemedText>
        </View>

        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#dc2626" />
          <ThemedText type="smallBold" style={{ color: "#dc2626", marginLeft: 8 }}>
            Выйти
          </ThemedText>
        </Pressable>

        <View style={{ marginTop: Spacing.five, alignItems: "center" }}>
          <ThemedText style={{ fontSize: 12, opacity: 0.4 }}>QrStars v1.0.0</ThemedText>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.three },
  centerArea: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.five, gap: Spacing.two },
  title: { fontSize: 28, lineHeight: 34, paddingTop: Spacing.four, paddingBottom: Spacing.three },
  infoCard: { flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: "rgba(128,128,128,0.08)", borderRadius: 14, padding: 16 },
  roleBadge: { marginTop: 4, alignSelf: "flex-start", backgroundColor: "rgba(79,70,229,0.1)", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  infoRow: { flexDirection: "row", alignItems: "center", marginTop: Spacing.three, paddingHorizontal: Spacing.two },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: Spacing.five, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: "rgba(220,38,38,0.3)" },
  loginBtn: { flexDirection: "row", backgroundColor: "#4f46e5", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, marginTop: Spacing.two, alignItems: "center" },
});
