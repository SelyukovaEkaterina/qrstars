import { jsonLdString } from "@/lib/site-seo";

/** Разметка schema.org для поисковиков (рендерится на сервере). */
export default function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
