import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { parseSetupIntentParam } from "@/lib/setup-utm-intent";

function querySuffix(searchParams: Record<string, string | string[] | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string" && value) qs.set(key, value);
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0]);
  }
  const encoded = qs.toString();
  return encoded ? `?${encoded}` : "";
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const params = await searchParams;
  const suffix = querySuffix(params);

  if (session?.user) {
    if (session.user.role === "ADMIN") {
      redirect("/admin");
    }
    redirect("/dashboard");
  }

  const intentRaw = typeof params.intent === "string" ? params.intent : params.intent?.[0];
  if (parseSetupIntentParam(intentRaw)) {
    redirect(`/register${suffix}`);
  }

  redirect(`/login${suffix}`);
}
