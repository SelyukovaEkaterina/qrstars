import Script from "next/script";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { isAnalyticsDisabled } from "@/lib/analytics-exclusion";
import YandexMetrikaTracker from "./YandexMetrikaTracker";

const METRIKA_ID = process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID ?? "109307713";

export default async function YandexMetrika() {
  if (!METRIKA_ID) return null;

  const cookieStore = await cookies();
  if (isAnalyticsDisabled(cookieStore)) return null;

  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">
        {`
(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document,'script','https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_ID}', 'ym');

ym(${METRIKA_ID}, 'init', {webvisor:true, clickmap:true, ecommerce:"dataLayer", accurateTrackBounce:true, trackLinks:true});
        `}
      </Script>
      <noscript>
        <div>
          <img
            src={`https://mc.yandex.ru/watch/${METRIKA_ID}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
      <Suspense fallback={null}>
        <YandexMetrikaTracker />
      </Suspense>
    </>
  );
}
