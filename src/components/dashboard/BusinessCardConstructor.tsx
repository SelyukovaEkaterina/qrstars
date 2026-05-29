"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSyncPropState } from "@/lib/sync-prop-state";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  formatMessengerContactLabel,
  messengerProviderLabel,
} from "@/lib/messenger-contact";
import type { MessengerContactItem } from "@/components/dashboard/MessengerContactsManager";

interface SocialLink {
  type: string;
  url: string;
}

interface BusinessCardData {
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
}

const defaultCard: BusinessCardData = {
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
};

const socialTypes = [
  { value: "telegram", label: "Telegram" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "vk", label: "VK" },
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "twitter", label: "Twitter / X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "github", label: "GitHub" },
];

interface BusinessCardConstructorProps {
  initialData?: BusinessCardData | null;
  brandColor?: string;
  onSave: (data: BusinessCardData) => Promise<void>;
  saving?: boolean;
}

export default function BusinessCardConstructor({
  initialData,
  brandColor,
  onSave,
  saving,
}: BusinessCardConstructorProps) {
  const cardSyncKey = initialData?.id ?? "new";
  const [card, setCard] = useSyncPropState(
    initialData ? { ...defaultCard, ...initialData } : defaultCard,
    cardSyncKey
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [messengerContacts, setMessengerContacts] = useState<MessengerContactItem[]>([]);

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

  const updateField = (
    field: keyof BusinessCardData,
    value: string | SocialLink[] | boolean | null
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
      socialLinks: [...prev.socialLinks, { type: "telegram", url: "" }],
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

  const handleSave = () => {
    if (!card.fullName.trim()) {
      setErrors({ fullName: "Имя обязательно" });
      return;
    }
    onSave(card);
  };

  const selectedContact = messengerContacts.find((c) => c.id === card.contactMessengerId);

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Основная информация</h3>
        <div className="space-y-4">
          <Input
            label="Имя *"
            value={card.fullName}
            onChange={(e) => updateField("fullName", e.target.value)}
            placeholder="Иван Иванов"
            error={errors.fullName}
          />
          <Input
            label="Должность"
            value={card.title || ""}
            onChange={(e) => updateField("title", e.target.value || null)}
            placeholder="Генеральный директор"
          />
          <Input
            label="Компания"
            value={card.company || ""}
            onChange={(e) => updateField("company", e.target.value || null)}
            placeholder="ООО «Ромашка»"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">О себе</label>
            <textarea
              value={card.about || ""}
              onChange={(e) => updateField("about", e.target.value || null)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Краткое описание или приветствие..."
            />
          </div>
          <Input
            label="Фото (URL)"
            value={card.avatarUrl || ""}
            onChange={(e) => updateField("avatarUrl", e.target.value || null)}
            placeholder="https://example.com/photo.jpg"
          />
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Контакты</h3>
        <div className="space-y-4">
          <Input
            label="Телефон"
            value={card.phone || ""}
            onChange={(e) => updateField("phone", e.target.value || null)}
            placeholder="+7 (999) 123-45-67"
            type="tel"
          />
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
            label="Адрес"
            value={card.address || ""}
            onChange={(e) => updateField("address", e.target.value || null)}
            placeholder="г. Москва, ул. Примерная, д. 1"
          />
        </div>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Социальные сети</h3>
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
                placeholder="https://t.me/username"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => removeSocialLink(index)}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
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
        <h3 className="font-semibold text-gray-900 mb-1">Связь</h3>
        <p className="text-sm text-gray-500 mb-4">
          Гости смогут написать вам через форму на визитке. Уведомление придёт в Telegram или MAX.
        </p>
        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <input
            type="checkbox"
            checked={card.contactEnabled ?? false}
            onChange={(e) => updateField("contactEnabled", e.target.checked)}
            className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
          />
          <span className="text-sm font-medium text-gray-700">
            Показывать кнопку «Написать человеку»
          </span>
        </label>

        {card.contactEnabled && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
              Куда приходят сообщения
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
                    Уведомления пойдут в {messengerProviderLabel(selectedContact.provider)}:{" "}
                    {formatMessengerContactLabel(selectedContact)}
                  </p>
                )}
                <Link
                  href="/dashboard/settings#notification-channels"
                  className="inline-block text-sm text-indigo-600 hover:text-indigo-800"
                >
                  Добавить или управлять контактами →
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

      <Button onClick={handleSave} disabled={saving}>
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
