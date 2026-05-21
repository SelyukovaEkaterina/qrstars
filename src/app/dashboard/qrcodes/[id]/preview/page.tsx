"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import Button from "@/components/ui/Button";
import BusinessCardView, { type BusinessCardData } from "@/components/scan/BusinessCardView";

interface ContactFields {
  contactEnabled?: boolean;
  contactMessengerId?: string | null;
}

type PreviewCard = BusinessCardData & ContactFields;

function showContactFormFor(card: ContactFields): boolean {
  return !!(card.contactEnabled && card.contactMessengerId);
}

export default function BusinessCardPreviewPage() {
  const params = useParams();
  const router = useRouter();
  const qrId = params.id as string;
  const [card, setCard] = useState<PreviewCard | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      const draftRaw = localStorage.getItem(`bc-draft-${qrId}`);

      fetch(`/api/qrcodes?id=${qrId}`)
        .then((r) => r.json())
        .then((data) => {
          if (!data.qrcode?.businessCard) return;

          const saved = data.qrcode.businessCard as PreviewCard;
          let merged: PreviewCard = { ...saved, id: saved.id };

          if (draftRaw) {
            try {
              const draft = JSON.parse(draftRaw) as PreviewCard;
              merged = {
                ...merged,
                ...draft,
                id: saved.id || draft.id || merged.id,
              };
            } catch {
              /* use saved */
            }
          }

          setCard(merged);
          setQrCode(data.qrcode.code);
        });
    });
  }, [qrId]);

  if (!card) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Загрузка...</p>
      </div>
    );
  }

  const safeCard: BusinessCardData = {
    id: card.id,
    fullName: card.fullName,
    title: card.title,
    company: card.company,
    phone: card.phone,
    email: card.email,
    website: card.website,
    address: card.address,
    about: card.about,
    avatarUrl: card.avatarUrl,
    socialLinks: card.socialLinks || [],
    accentColor: card.accentColor,
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/dashboard/qrcodes/${qrId}`)}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Назад к редактору
        </Button>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <ExternalLink className="w-4 h-4" />
          Превью визитки
        </div>
      </div>

      <div className="flex-1 relative">
        <BusinessCardView
          card={safeCard}
          qrCode={qrCode ?? undefined}
          showContactForm={showContactFormFor(card)}
        />
      </div>
    </div>
  );
}
