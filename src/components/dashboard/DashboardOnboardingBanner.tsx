"use client";

import { Store, QrCode, Plus, Link2, ArrowRight } from "lucide-react";
import Button from "@/components/ui/Button";

interface Establishment {
  id: string;
  name: string;
}

interface QRCodeItem {
  id: string;
  code: string;
  label: string | null;
  establishmentId: string | null;
  isActive: boolean;
}

interface Props {
  establishments: Establishment[];
  qrcodes: QRCodeItem[];
  onCreateEstablishment: () => void;
  onCreateQr: (establishmentId: string) => void;
  onLinkQr: (establishmentId: string) => void;
}

export default function DashboardOnboardingBanner({
  establishments,
  qrcodes,
  onCreateEstablishment,
  onCreateQr,
  onLinkQr,
}: Props) {
  const unlinkedQrcodes = qrcodes.filter((q) => !q.establishmentId);

  const establishmentsWithoutQr = establishments.filter(
    (est) => !qrcodes.some((q) => q.establishmentId === est.id)
  );

  if (establishments.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 sm:flex-row sm:items-center">
        <Store className="w-5 h-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium">У вас нет организации</p>
          <p className="text-sm opacity-90 mt-0.5">
            Создайте организацию, чтобы привязать QR-код и начать собирать отзывы
          </p>
        </div>
        <Button size="sm" onClick={onCreateEstablishment}>
          Завести организацию
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  }

  if (establishmentsWithoutQr.length === 0) {
    return null;
  }

  const linkBtnClass =
    "bg-white/80 border-indigo-200 text-indigo-900 hover:bg-white";

  return (
    <div className="flex flex-col gap-4 p-4 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <QrCode className="w-5 h-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-3">
          {establishmentsWithoutQr.length === 1 ? (
            <div>
              <p className="font-medium">
                У организации «{establishmentsWithoutQr[0].name}» нет QR-кода
              </p>
              <p className="text-sm opacity-90 mt-0.5">
                Выпустите новый код или привяжите уже существующий неактивный
              </p>
            </div>
          ) : (
            <div>
              <p className="font-medium">
                У {establishmentsWithoutQr.length} организаций нет QR-кода
              </p>
              <p className="text-sm opacity-90 mt-0.5">
                Выпустите или привяжите код для каждой организации
              </p>
            </div>
          )}

          {establishmentsWithoutQr.length === 1 ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className={linkBtnClass}
                onClick={() => onLinkQr(establishmentsWithoutQr[0].id)}
                disabled={unlinkedQrcodes.length === 0}
                title={
                  unlinkedQrcodes.length === 0
                    ? "Нет непривязанных QR-кодов"
                    : undefined
                }
              >
                <Link2 className="w-4 h-4 mr-1" />
                Привязать
              </Button>
              <Button
                size="sm"
                onClick={() => onCreateQr(establishmentsWithoutQr[0].id)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Выпустить QR
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {establishmentsWithoutQr.map((est) => (
                <div
                  key={est.id}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between py-2 border-t border-indigo-200/60 first:border-0 first:pt-0"
                >
                  <span className="text-sm font-medium truncate">{est.name}</span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className={linkBtnClass}
                      onClick={() => onLinkQr(est.id)}
                      disabled={unlinkedQrcodes.length === 0}
                    >
                      <Link2 className="w-3.5 h-3.5 mr-1" />
                      Привязать
                    </Button>
                    <Button size="sm" onClick={() => onCreateQr(est.id)}>
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Выпустить
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
