"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSyncPropState } from "@/lib/sync-prop-state";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Camera, Loader2, Plus, Trash2 } from "lucide-react";
import {
  formatMessengerContactLabel,
  messengerProviderLabel,
} from "@/lib/messenger-contact";
import type { MessengerContactItem } from "@/components/dashboard/MessengerContactsManager";
import {
  MASTER_PROFESSION_SUGGESTIONS,
  MAX_CARD_SERVICES,
  type CardService,
} from "@/lib/business-card";

interface SocialLink {
  type: string;
  url: string;
}

export interface BusinessCardFormData {
  id?: string;
  fullName: string;
  title: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  about: string | null;
  avatarUrl: string | null;
  socialLinks: SocialLink[];
  theme?: string;
  accentColor: string;
  contactEnabled?: boolean;
  contactMessengerId?: string | null;
  contactMessenger?: Pick<
    MessengerContactItem,
    "id" | "provider" | "externalId" | "label"
  > | null;
  tipsUrl?: string | null;
  tipsLabel?: string | null;
  whatsapp?: string | null;
  telegram?: string | null;
  maxUrl?: string | null;
  services?: CardService[];
  serviceArea?: string | null;
  workHours?: string | null;
  reviewsUrl?: string | null;
}

const defaultCard: BusinessCardFormData = {
  fullName: "",
  title: null,
  company: null,
  phone: null,
  email: null,
  website: null,
  address: null,
  about: null,
  avatarUrl: null,
  socialLinks: [],
  theme: "minimal",
  accentColor: "#4f46e5",
  contactEnabled: false,
  contactMessengerId: null,
  contactMessenger: null,
  tipsUrl: null,
  tipsLabel: null,
  whatsapp: null,
  telegram: null,
  maxUrl: null,
  services: [],
  serviceArea: null,
  workHours: null,
  reviewsUrl: null,
};

const socialTypes = [
  { value: "vk", label: "VK" },
  { value: "telegram", label: "Telegram-канал" },
  { value: "youtube", label: "YouTube" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "TikTok" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "max", label: "MAX" },
  { value: "facebook", label: "Facebook" },
  { value: "twitter", label: "Twitter / X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "github", label: "GitHub" },
];

const AVATAR_MAX_PX = 512;

/** Фото с телефона весит мегабайты — ужимаем до 512 px JPEG перед загрузкой. */
async function resizeAvatar(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AVATAR_MAX_PX / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Не удалось обработать фото");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Не удалось обработать фото"))),
      "image/jpeg",
      0.85,
    ),
  );
}

const textareaClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

interface BusinessCardConstructorProps {
  initialData?: BusinessCardFormData | null;
  brandColor?: string;
  onSave: (data: BusinessCardFormData) => Promise<void>;
  /** Каждое изменение формы — для живого превью. */
  onChange?: (data: BusinessCardFormData) => void;
  saving?: boolean;
}

export default function BusinessCardConstructor({
  initialData,
  onSave,
  onChange,
  saving,
}: BusinessCardConstructorProps) {
  const cardSyncKey = initialData?.id ?? "new";
  const [card, setCard] = useSyncPropState(
    initialData ? { ...defaultCard, ...initialData } : defaultCard,
    cardSyncKey
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [messengerContacts, setMessengerContacts] = useState<MessengerContactItem[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const services = card.services ?? [];

  const fetchMessengerContacts = useCallback(() => {
    fetch("/api/messenger-contacts")
      .then((r) => r.json())
      .then((res) => {
        if (res.contacts) setMessengerContacts(res.contacts);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchMessengerContacts();
  }, [fetchMessengerContacts]);

  useEffect(() => {
    onChange?.(card);
  }, [card, onChange]);

  const updateField = (
    field: keyof BusinessCardFormData,
    value: string | SocialLink[] | CardService[] | boolean | null
  ) => {
    setCard((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const addSocialLink = () => {
    setCard((prev) => ({
      ...prev,
      socialLinks: [...prev.socialLinks, { type: "vk", url: "" }],
    }));
  };

  const removeSocialLink = (index: number) => {
    setCard((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((_, i) => i !== index),
    }));
  };

  const updateSocialLink = (index: number, field: "type" | "url", value: string) => {
    setCard((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.map((link, i) =>
        i === index ? { ...link, [field]: value } : link
      ),
    }));
  };

  const updateService = (index: number, field: keyof CardService, value: string) => {
    updateField(
      "services",
      services.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, avatarUrl: "Выберите фото (JPG, PNG, HEIC)" }));
      return;
    }
    setUploadingAvatar(true);
    try {
      const blob = await resizeAvatar(file);
      const formData = new FormData();
      formData.append("file", new File([blob], "avatar.jpg", { type: "image/jpeg" }));
      formData.append("title", "Фото для визитки");
      const res = await fetch("/api/file-assets/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось загрузить фото");
      updateField("avatarUrl", data.fileAsset.fileUrl);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        avatarUrl: err instanceof Error ? err.message : "Не удалось загрузить фото",
      }));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = () => {
    if (!card.fullName.trim()) {
      setErrors({ fullName: "Имя обязательно" });
      return;
    }
    onSave({ ...card, services: services.filter((s) => s.name.trim()) });
  };

  const selectedContact = messengerContacts.find((c) => c.id === card.contactMessengerId);

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Основная информация</h3>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            {card.avatarUrl ? (
              <img
                src={card.avatarUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-full border border-gray-200 object-cover"
              />
            ) : (
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Camera className="h-6 w-6" />
              </span>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4 mr-1" />
                )}
                {card.avatarUrl ? "Заменить фото" : "Загрузить фото"}
              </Button>
              {card.avatarUrl && (
                <Button type="button" variant="outline" size="sm" onClick={() => updateField("avatarUrl", null)}>
                  Убрать
                </Button>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleAvatarUpload(e)}
              />
            </div>
          </div>
          {errors.avatarUrl && <p className="text-sm text-red-600">{errors.avatarUrl}</p>}
          <Input
            label="Имя *"
            value={card.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
            placeholder="Иван Иванов"
            error={errors.fullName}
          />
          <div>
            <Input
              label="Профессия или должность"
              value={card.title || ""}
              onChange={(e) => updateField("title", e.target.value || null)}
              placeholder="Электрик"
              list="card-profession-suggestions"
            />
            <datalist id="card-profession-suggestions">
              {MASTER_PROFESSION_SUGGESTIONS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>
          <Input
            label="Компания"
            value={card.company || ""}
            onChange={(e) => updateField("company", e.target.value || null)}
            placeholder="Необязательно"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">О себе</label>
            <textarea
              value={card.about || ""}
              onChange={(e) => updateField("about", e.target.value || null)}
              rows={3}
              className={textareaClass}
              placeholder="Опыт 10 лет, работаю с гарантией, приеду в день обращения"
            />
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-1">Телефон и мессенджеры</h3>
        <p className="text-sm text-gray-500 mb-4">
          На визитке это крупные кнопки: клиент звонит или пишет в один тап.
        </p>
        <div className="space-y-4">
          <Input
            label="Телефон"
            value={card.phone || ""}
            onChange={(e) => updateField("phone", e.target.value || null)}
            placeholder="+7 (999) 123-45-67"
            type="tel"
          />
          <div>
            <Input
              label="WhatsApp"
              value={card.whatsapp || ""}
              onChange={(e) => updateField("whatsapp", e.target.value || null)}
              placeholder="Номер или ссылка wa.me"
              type="tel"
            />
            {card.phone && card.whatsapp !== card.phone && (
              <button
                type="button"
                className="mt-1 text-xs font-medium text-indigo-600 hover:text-indigo-800"
                onClick={() => updateField("whatsapp", card.phone)}
              >
                Тот же номер, что и телефон
              </button>
            )}
          </div>
          <Input
            label="Telegram"
            value={card.telegram || ""}
            onChange={(e) => updateField("telegram", e.target.value || null)}
            placeholder="@username или номер"
          />
          <Input
            label="MAX"
            value={card.maxUrl || ""}
            onChange={(e) => updateField("maxUrl", e.target.value || null)}
            placeholder="Ссылка на профиль в MAX"
          />
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-1">Услуги и цены</h3>
        <p className="text-sm text-gray-500 mb-4">
          Клиент сразу видит, чем вы занимаетесь и сколько это стоит. Цена — любым текстом: «от 500 ₽», «договорная».
        </p>
        <div className="space-y-2">
          {services.map((service, index) => (
            <div key={index} className="flex items-start gap-2">
              <input
                value={service.name}
                onChange={(e) => updateService(index, "name", e.target.value)}
                placeholder="Замена розетки"
                maxLength={120}
                className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                value={service.price}
                onChange={(e) => updateService(index, "price", e.target.value)}
                placeholder="от 500 ₽"
                maxLength={40}
                className="w-28 sm:w-32 shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={() => updateField("services", services.filter((_, i) => i !== index))}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                aria-label="Удалить услугу"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {services.length < MAX_CARD_SERVICES && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateField("services", [...services, { name: "", price: "" }])}
            >
              <Plus className="w-4 h-4 mr-1" />
              Добавить услугу
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Где и когда работаете</h3>
        <div className="space-y-4">
          <Input
            label="Город или район"
            value={card.serviceArea || ""}
            onChange={(e) => updateField("serviceArea", e.target.value || null)}
            placeholder="Казань, выезд по городу и пригороду"
          />
          <Input
            label="Часы работы"
            value={card.workHours || ""}
            onChange={(e) => updateField("workHours", e.target.value || null)}
            placeholder="Ежедневно 8:00–21:00"
          />
          <div>
            <Input
              label="Ссылка на отзывы о вас"
              value={card.reviewsUrl || ""}
              onChange={(e) => updateField("reviewsUrl", e.target.value || null)}
              placeholder="Профиль на Авито, Профи или Яндекс Картах"
            />
            <p className="mt-1 text-xs text-gray-500">
              На визитке появится кнопка «Отзывы обо мне» — так новому клиенту проще вам доверять.
            </p>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Email, сайт, адрес</h3>
        <div className="space-y-4">
          <Input
            label="Email"
            value={card.email || ""}
            onChange={(e) => updateField("email", e.target.value || null)}
            placeholder="ivan@example.com"
            type="email"
          />
          <Input
            label="Сайт"
            value={card.website || ""}
            onChange={(e) => updateField("website", e.target.value || null)}
            placeholder="https://example.com"
          />
          <Input
            label="Адрес мастерской или офиса"
            value={card.address || ""}
            onChange={(e) => updateField("address", e.target.value || null)}
            placeholder="г. Москва, ул. Примерная, д. 1"
          />
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Соцсети</h3>
        <div className="space-y-3">
          {card.socialLinks.map((link, index) => (
            <div key={index} className="flex items-start gap-2">
              <select
                value={link.type}
                onChange={(e) => updateSocialLink(index, "type", e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-36"
              >
                {socialTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <input
                value={link.url}
                onChange={(e) => updateSocialLink(index, "url", e.target.value)}
                placeholder="https://vk.com/username"
                className="min-w-0 flex-1 px-3 py-2 border border-gray-300 rounded-lg text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => removeSocialLink(index)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                aria-label="Удалить ссылку"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addSocialLink}>
            <Plus className="w-4 h-4 mr-1" />
            Добавить соцсеть
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-1">Заявки с визитки</h3>
        <p className="text-sm text-gray-500 mb-4">
          Клиент оставит имя, телефон и описание задачи. Заявка придёт на email, в Telegram или MAX.
        </p>
        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={card.contactEnabled ?? false}
            onChange={(e) => updateField("contactEnabled", e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Показывать кнопку «Оставить заявку»
          </span>
        </label>

        {card.contactEnabled && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Куда приходят заявки
            </label>
            {messengerContacts.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                Сначала{" "}
                <Link href="/dashboard/settings#notification-channels" className="underline font-medium">
                  подключите контакт
                </Link>{" "}
                в настройках («Каналы для уведомлений»).
              </p>
            ) : (
              <>
                <select
                  value={card.contactMessengerId ?? ""}
                  onChange={(e) =>
                    updateField("contactMessengerId", e.target.value || null)
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Выберите контакт</option>
                  {messengerContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {formatMessengerContactLabel(contact)} (
                      {messengerProviderLabel(contact.provider)})
                    </option>
                  ))}
                </select>
                {selectedContact && (
                  <p className="text-xs text-gray-500">
                    Заявки пойдут в {messengerProviderLabel(selectedContact.provider)}:{" "}
                    {formatMessengerContactLabel(selectedContact)}
                  </p>
                )}
                <Link
                  href="/dashboard/settings#notification-channels"
                  className="inline-block text-sm text-indigo-600 hover:text-indigo-800"
                >
                  Подключить Telegram или MAX →
                </Link>
              </>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-1">Чаевые</h3>
        <p className="text-sm text-gray-500 mb-4">
          Добавьте ссылку на сервис чаевых. На визитке появится кнопка.
        </p>
        <div className="space-y-4">
          <Input
            label="Ссылка на чаевые"
            value={card.tipsUrl || ""}
            onChange={(e) => updateField("tipsUrl", e.target.value || null)}
            placeholder="https://boosty.to/..."
          />
          <Input
            label="Текст кнопки"
            value={card.tipsLabel || ""}
            onChange={(e) => updateField("tipsLabel", e.target.value || null)}
            placeholder="Оставить чаевые"
          />
        </div>
      </Card>

      <Button onClick={handleSave} disabled={saving || uploadingAvatar}>
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Сохранение...
          </>
        ) : (
          "Сохранить визитку"
        )}
      </Button>
    </div>
  );
}
