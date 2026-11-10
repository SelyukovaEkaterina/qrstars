import { AlertTriangle } from "lucide-react";
import { BEGET_INCIDENT } from "@/lib/incident";

/** Плашка об аварии Beget: что случилось и как вернуть свой QR. */
export default function IncidentBanner({ restoreHref = "/dashboard/restore" }: { restoreHref?: string | null }) {
  if (!BEGET_INCIDENT.active) return null;
  return (
    <div role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
        <p className="min-w-0 flex-1">
          {BEGET_INCIDENT.dateLabel} у хостинг-провайдера Beget произошла авария (
          <a
            href={BEGET_INCIDENT.newsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline underline-offset-2"
          >
            РБК
          </a>
          ), часть данных утрачена. Если ваш QR-код перестал работать — восстановите его по ID кода: настройки придётся указать заново.
        </p>
        {restoreHref && (
          <a
            href={restoreHref}
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
          >
            Восстановить QR
          </a>
        )}
      </div>
    </div>
  );
}
