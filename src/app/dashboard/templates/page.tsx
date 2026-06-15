import { redirect } from "next/navigation";
import { TEMPLATE_ROUTES } from "@/lib/template-routes";

export default async function TemplatesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const tab = typeof params.tab === "string" ? params.tab : undefined;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "tab" || value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => qs.append(key, v));
    } else {
      qs.set(key, value);
    }
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";

  if (tab === "table-tent") {
    redirect(`${TEMPLATE_ROUTES.tableTents}${suffix}`);
  }
  redirect(`${TEMPLATE_ROUTES.qr}${suffix}`);
}
