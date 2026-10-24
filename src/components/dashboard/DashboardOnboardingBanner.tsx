"use client";

import { Store, QrCode, Plus, Link2, ArrowRight } from "lucide-react";
import Button from "@/components/ui/Button";
import { pluralize, quotedEstablishmentName } from "@/lib/utils";

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
  filterEstId?: string;
  onCreateEstablishment: () => void;
  onCreateQr: (establishmentId: string) => void;
  onLinkQr: (establishmentId: string) => void;
}

export default function DashboardOnboardingBanner({
  establishments,
  qrcodes,
  filterEstId = "all",
  onCreateEstablishment,
  onCreateQr,
  onLinkQr,
}: Props) {
  const unlinkedQrcodes = qrcodes.filter((q) => !q.establishmentId);
  const canLink = unlinkedQrcodes.length > 0;

  if (filterEstId !== "all") {
    return null;
  }

  const establishmentsWithoutQr = establishments.filter(
    (est) => !qrcodes.some((q) => q.establishmentId === est.id)
  );

  if (establishments.length === 0) {
    return (
      <div className="flex flex-col gap-4 p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 sm:flex-row sm:items-center">
        <Store className="w-5 h-5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium">У вас нет проекта</p>
          <p className="text-sm opacity-90 mt-0.5">
            Создайте проект, чтобы привязать QR-код и настроить микросайт
          </p>
        </div>
        <Button size="sm" className="h-10" onClick={onCreateEstablishment}>
          Создать проект
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
                У проекта {quotedEstablishmentName(establishmentsWithoutQr[0].name)} нет QR-кода
              </p>
              <p className="text-sm opacity-90 mt-0.5">
                {canLink
                  ? "Выпустите новый код или привяжите уже существующий неактивный"
                  : "Выпустите новый код — у него будет свой сценарий перехода"}
              </p>
            </div>
          ) : (
            <div>
              <p className="font-medium">
                У {establishmentsWithoutQr.length} {pluralize(establishmentsWithoutQr.length, "проекта", "проектов", "проектов")} нет QR-кода
              </p>
              <p className="text-sm opacity-90 mt-0.5">
                {canLink
                  ? "Выпустите или привяжите код для каждого проекта"
                  : "Выпустите код для каждого проекта"}
              </p>
            </div>
          )}

          {establishmentsWithoutQr.length === 1 ? (
            <div className="flex flex-wrap gap-2">
              {canLink && (
                <Button
                  size="sm"
                  variant="outline"
                  className={`h-10 ${linkBtnClass}`}
                  onClick={() => onLinkQr(establishmentsWithoutQr[0].id)}
                >
                  <Link2 className="w-4 h-4 mr-1" />
                  Привязать
                </Button>
              )}
              <Button
                size="sm"
                className="h-10"
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
                    {canLink && (
                      <Button
                        size="sm"
                        variant="outline"
                        className={`h-10 ${linkBtnClass}`}
                        onClick={() => onLinkQr(est.id)}
                      >
                        <Link2 className="w-3.5 h-3.5 mr-1" />
                        Привязать
                      </Button>
                    )}
                    <Button size="sm" className="h-10" onClick={() => onCreateQr(est.id)}>
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
