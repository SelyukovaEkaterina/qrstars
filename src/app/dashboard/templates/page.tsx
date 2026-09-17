import { redirect } from "next/navigation";
import { templateSettingsPath } from "@/lib/template-routes";

export default async function TemplatesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  redirect(templateSettingsPath(await searchParams, ["tab"]));
}
