import { useState } from "react";
import { Pressable, StyleSheet, View, TextInput, Alert, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useAuthStore } from "@/store/auth";

export default function LoginScreen() {
  const { login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Ошибка", "Введите email и пароль");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/my-codes");
    } catch {
      Alert.alert("Ошибка", "Неверный email или пароль");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Вход
          </ThemedText>
          <ThemedText type="small" style={styles.subtitle}>
            Войдите, чтобы создавать динамические QR-коды
          </ThemedText>
        </View>

        <View style={styles.form}>
          <ThemedText type="smallBold">Email</ThemedText>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#999"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <ThemedText type="smallBold" style={styles.label}>
            Пароль
          </ThemedText>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor="#999"
            secureTextEntry
          />

          <Pressable style={styles.btn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText type="smallBold" style={{ color: "#fff" }}>
                Войти
              </ThemedText>
            )}
          </Pressable>

          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ThemedText type="small">Назад</ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: Spacing.four },
  header: { paddingTop: Spacing.five, paddingBottom: Spacing.four, alignItems: "center" },
  title: { fontSize: 32, lineHeight: 38 },
  subtitle: { textAlign: "center", opacity: 0.6 },
  form: { gap: Spacing.two },
  label: { marginTop: Spacing.two },
  input: {
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.3)",
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 16,
    color: "#000",
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  btn: {
    backgroundColor: "#4f46e5",
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.three,
  },
  backBtn: { alignItems: "center", paddingVertical: Spacing.two },
});
