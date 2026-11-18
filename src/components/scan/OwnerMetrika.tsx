"use client";

import Script from "next/script";
import { useEffect } from "react";
import { OWNER_METRIKA_SECTION_EVENT, type OwnerMetrikaSource } from "@/lib/owner-metrika";

type YmFn = (id: number, method: string, ...args: unknown[]) => void;

/**
 * Счётчик Яндекс Метрики владельца проекта (PRO / «Сеть») на гостевых страницах.
 * Грузится тем же tag.js, что и наш счётчик (загрузчик не подключает скрипт дважды).
 * Вебвизор выключен: гости вводят телефоны и тексты жалоб.
 * Параметры визита «Источник» (QR-код / прямая ссылка) и «QR-код» — для отчёта
 * «Параметры визитов». Переходы между разделами микросайта (`?s=`) — отдельные просмотры.
 */
export default function OwnerMetrika({
  counterId,
  source,
  qrCode,
}: {
  counterId: string;
  source: OwnerMetrikaSource;
  qrCode?: string | null;
}) {
  const id = Number(counterId);

  useEffect(() => {
    const onSection = () => {
      const ym = (window as unknown as { ym?: YmFn }).ym;
      if (typeof ym !== "function") return;
      ym(id, "hit", window.location.href, { title: document.title, referer: document.referrer });
    };
    window.addEventListener(OWNER_METRIKA_SECTION_EVENT, onSection);
    return () => window.removeEventListener(OWNER_METRIKA_SECTION_EVENT, onSection);
  }, [id]);

  if (!Number.isSafeInteger(id) || id <= 0) return null;

  const params: Record<string, string> = {
    "Источник": source === "qr" ? "QR-код" : "Прямая ссылка",
  };
  if (qrCode) params["QR-код"] = qrCode;

  return (
    <>
      <Script id={`owner-metrika-${id}`} strategy="afterInteractive">
        {`
(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${id}', 'ym');
ym(${id}, 'init', {webvisor:false, clickmap:true, trackLinks:true, accurateTrackBounce:true, params:${JSON.stringify(params)}});
        `}
      </Script>
      <noscript>
        <div>
          <img src={`https://mc.yandex.ru/watch/${id}`} style={{ position: "absolute", left: "-9999px" }} alt="" />
        </div>
      </noscript>
    </>
  );
}
