import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, TextInput, View, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { QRPreview } from "@/components/qr-preview";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useDesignStore } from "@/store/design";
import { buildQRPayload } from "@/qr/payload";
import { COLOR_PRESETS, QR_CODE_TEMPLATES } from "@/qr/presets";
import type { QRContentState, QRTemplateConfig } from "@/qr/types";
import { saveQrToGallery, shareQr } from "@/qr/save";

export default function GeneratorScreen() {
  const { config, content, setConfig, setContent, applyPreset } = useDesignStore();
  const [saving, setSaving] = useState(false);

  const payload = buildQRPayload(content) || "https://qrstars.ru";

  function report(res: { ok: boolean; message: string }) {
    if (res.ok && res.message) {
      Alert.alert("Готово", res.message);
    } else if (!res.ok) {
      Alert.alert("Не получилось", res.message);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      report(await saveQrToGallery(config, payload));
    } finally {
      setSaving(false);
    }
  }

  async function handleShare() {
    setSaving(true);
    try {
      report(await shareQr(config, payload));
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <ThemedText type="title" style={styles.header}>
            Генератор QR
          </ThemedText>

          <View style={styles.previewWrap}>
            <View style={styles.previewCard}>
              <QRPreview config={config} payload={payload} maxWidth={280} />
            </View>
          </View>

          <Section title="Шаблон">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {QR_CODE_TEMPLATES.map((preset) => (
                <PresetCard
                  key={preset.id}
                  name={preset.name}
                  accent={preset.accent}
                  selected={false}
                  onPress={() => applyPreset(preset.config)}
                />
              ))}
            </ScrollView>
          </Section>

          <Section title="Содержимое">
            <ContentTypeSelector content={content} setContent={setContent} />
          </Section>

          <Section title="Цвет">
            <View style={styles.colorRow}>
              {COLOR_PRESETS.map((c) => (
                <ColorSwatch
                  key={c.name}
                  label={c.name}
                  fg={c.fg}
                  bg={c.bg}
                  selected={
                    config.fg === c.fg &&
                    config.bg === c.bg &&
                    config.gradient === c.gradient
                  }
                  onPress={() =>
                    setConfig({
                      fg: c.fg,
                      bg: c.bg,
                      gradient: c.gradient,
                      ...(c.grad1 ? { grad1: c.grad1 } : {}),
                      ...(c.grad2 ? { grad2: c.grad2 } : {}),
                      ...(c.gradType ? { gradType: c.gradType } : {}),
                    })
                  }
                />
              ))}
            </View>
          </Section>

          <Section title="Точки">
            <SegmentedControl
              options={[
                { id: "classic", label: "Квадрат" },
                { id: "rounded", label: "Скругл" },
              ]}
              value={config.dotStyle}
              onChange={(v) => setConfig({ dotStyle: v as QRTemplateConfig["dotStyle"] })}
            />
          </Section>

          <Section title="Глаза">
            <SegmentedControl
              options={[
                { id: "square", label: "Кв" },
                { id: "rounded", label: "Скр" },
                { id: "circle", label: "Кр" },
                { id: "leaf", label: "Лист" },
                { id: "dot", label: "Тчк" },
              ]}
              value={config.eyeStyle}
              onChange={(v) => setConfig({ eyeStyle: v as QRTemplateConfig["eyeStyle"] })}
            />
          </Section>

          <Section title="Логотип">
            <LogoControl config={config} setConfig={setConfig} />
          </Section>
        </ScrollView>

        <View style={styles.bottomBar}>
          <Pressable style={[styles.btn, styles.btnOutline]} onPress={handleShare} disabled={saving}>
            <ThemedText type="smallBold">Поделиться</ThemedText>
          </Pressable>
          <Pressable style={[styles.btn, styles.btnPrimary]} onPress={handleSave} disabled={saving}>
            <ThemedText type="smallBold" themeColor="text">
              {saving ? "Сохраняем…" : "Сохранить в галерею"}
            </ThemedText>
          </Pressable>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function ContentTypeSelector({
  content,
  setContent,
}: {
  content: QRContentState;
  setContent: (patch: Partial<QRContentState>) => void;
}) {
  const types: { id: QRContentState["type"]; label: string }[] = [
    { id: "url", label: "Ссылка" },
    { id: "text", label: "Текст" },
    { id: "wifi", label: "Wi-Fi" },
    { id: "email", label: "Email" },
    { id: "phone", label: "Тел" },
  ];
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.two }}>
        {types.map((t) => (
          <Chip
            key={t.id}
            label={t.label}
            selected={content.type === t.id}
            onPress={() => setContent({ type: t.id })}
          />
        ))}
      </ScrollView>
      {content.type === "url" && (
        <StyledInput value={content.url} onChangeText={(v) => setContent({ url: v })} placeholder="https://..." />
      )}
      {content.type === "text" && (
        <StyledInput value={content.text} onChangeText={(v) => setContent({ text: v })} placeholder="Любой текст" multiline />
      )}
      {content.type === "wifi" && (
        <View>
          <StyledInput value={content.wifiSsid} onChangeText={(v) => setContent({ wifiSsid: v })} placeholder="SSID сети" />
          <StyledInput value={content.wifiPass} onChangeText={(v) => setContent({ wifiPass: v })} placeholder="Пароль" secureTextEntry />
        </View>
      )}
      {content.type === "email" && (
        <View>
          <StyledInput value={content.emailAddr} onChangeText={(v) => setContent({ emailAddr: v })} placeholder="email@example.com" />
          <StyledInput value={content.emailSubj} onChangeText={(v) => setContent({ emailSubj: v })} placeholder="Тема (опц.)" />
        </View>
      )}
      {content.type === "phone" && (
        <StyledInput value={content.phone} onChangeText={(v) => setContent({ phone: v })} placeholder="+7..." keyboardType="phone-pad" />
      )}
    </View>
  );
}

function LogoControl({
  config,
  setConfig,
}: {
  config: QRTemplateConfig;
  setConfig: (patch: Partial<QRTemplateConfig>) => void;
}) {
  const hasCustomLogo = !!config.logoDataUrl;

  async function pickLogo() {
    try {
      const ImagePicker = require("expo-image-picker");
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images" as const,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        base64: true,
      });
      if (res.canceled) return;
      const asset = res.assets?.[0];
      if (!asset) return;

      let dataUrl: string | null = null;
      if (asset.base64) {
        dataUrl = `data:image/png;base64,${asset.base64}`;
      } else if (asset.uri) {
        const { readAsStringAsync, EncodingType } =
          require("expo-file-system/legacy");
        const b64 = await readAsStringAsync(asset.uri, {
          encoding: EncodingType.Base64,
        });
        dataUrl = `data:image/png;base64,${b64}`;
      }
      if (dataUrl) {
        setConfig({ logoDataUrl: dataUrl, logoPreset: null, centerMode: "image" });
      }
    } catch (e) {
      Alert.alert("Не получилось загрузить фото", String(e));
    }
  }

  return (
    <View>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.chip, !config.logoPreset && !hasCustomLogo && styles.chipActive]}
          onPress={() => setConfig({ logoPreset: null, logoDataUrl: null, centerMode: "image" })}
        >
          <ThemedText type="small">Без логотипа</ThemedText>
        </Pressable>
        {hasCustomLogo && (
          <View style={[styles.chip, styles.chipActive]}>
            <ThemedText type="small">Своё фото</ThemedText>
          </View>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {[
          { emoji: "☕", name: "Кафе" },
          { emoji: "🍽️", name: "Ресторан" },
          { emoji: "🦷", name: "Дент" },
          { emoji: "💊", name: "Апт" },
          { emoji: "💅", name: "Бьюти" },
          { emoji: "🚗", name: "Авто" },
          { emoji: "🏋️", name: "Фит" },
          { emoji: "🏨", name: "Отель" },
          { emoji: "🍺", name: "Бар" },
          { emoji: "❤️", name: "Серд" },
          { emoji: "⭐", name: "Звезда" },
          { emoji: "🔥", name: "Огонь" },
        ].map((p) => (
          <Pressable
            key={p.emoji}
            style={[styles.emojiChip, config.logoPreset === p.emoji && styles.chipActive]}
            onPress={() => setConfig({ logoPreset: p.emoji, logoDataUrl: null, centerMode: "image" })}
          >
            <ThemedText style={{ fontSize: 24 }}>{p.emoji}</ThemedText>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable style={styles.uploadBtn} onPress={pickLogo}>
        <ThemedText type="smallBold">
          {hasCustomLogo ? "Заменить фото" : "Загрузить своё фото"}
        </ThemedText>
      </Pressable>
    </View>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((o) => (
        <Pressable
          key={o.id}
          style={[styles.segment, value === o.id && styles.segmentActive]}
          onPress={() => onChange(o.id)}
        >
          <ThemedText type="small" style={value === o.id && { color: "#fff" }}>
            {o.label}
          </ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function PresetCard({
  name,
  accent,
  onPress,
}: {
  name: string;
  accent: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.presetCard} onPress={onPress}>
      <View style={[styles.presetDot, { backgroundColor: accent }]} />
      <ThemedText type="small">{name}</ThemedText>
    </Pressable>
  );
}

function ColorSwatch({
  label,
  fg,
  bg,
  selected,
  onPress,
}: {
  label: string;
  fg: string;
  bg: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.colorSwatch, selected && styles.colorSwatchSelected]}
      onPress={onPress}
    >
      <View style={[styles.swatchPreview, { backgroundColor: bg }]}>
        <View style={[styles.swatchDot, { backgroundColor: fg }]} />
      </View>
      <ThemedText type="small" style={{ fontSize: 10 }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      style={[styles.chip, selected && styles.chipActive]}
      onPress={onPress}
    >
      <ThemedText type="small" style={selected && { color: "#fff" }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function StyledInput(props: React.ComponentProps<typeof TextInput>) {
  const extraStyle: typeof props.style = props.multiline
    ? { height: 80, textAlignVertical: "top" }
    : { height: 44 };
  return (
    <TextInput
      {...props}
      style={[styles.input, extraStyle, props.style]}
      placeholderTextColor="#999"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.three, paddingBottom: 100, gap: Spacing.one },
  header: { fontSize: 28, lineHeight: 34, paddingTop: Spacing.four, paddingBottom: Spacing.two },
  previewWrap: { alignItems: "center", paddingVertical: Spacing.three },
  previewCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  section: { gap: Spacing.two, paddingTop: Spacing.three },
  sectionTitle: { fontSize: 15 },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.two },
  colorSwatch: { alignItems: "center", gap: 4, width: 56 },
  colorSwatchSelected: { transform: [{ scale: 1.1 }] },
  swatchPreview: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  swatchDot: { width: 20, height: 20, borderRadius: 10 },
  segmentRow: { flexDirection: "row", gap: 6 },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "rgba(128,128,128,0.12)",
  },
  segmentActive: { backgroundColor: "#4f46e5" },
  presetCard: {
    alignItems: "center",
    gap: 6,
    marginRight: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(128,128,128,0.1)",
  },
  presetDot: { width: 28, height: 28, borderRadius: 14 },
  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(128,128,128,0.12)",
    marginRight: 8,
  },
  chipActive: { backgroundColor: "#4f46e5" },
  emojiChip: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(128,128,128,0.1)",
    marginRight: 8,
  },
  uploadBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#4f46e5",
    alignItems: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(128,128,128,0.3)",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 15,
    marginBottom: 8,
    color: "#000",
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  bottomBar: {
    flexDirection: "row",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.15)",
  },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  btnOutline: { borderWidth: 2, borderColor: "#4f46e5" },
  btnPrimary: { backgroundColor: "#4f46e5" },
});
