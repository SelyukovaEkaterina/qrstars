import { redirect } from "next/navigation";

export default async function LegacyEstablishmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  if (sp.create === "1") {
    redirect("/dashboard/projects?create=1");
  }
  redirect("/dashboard/projects");
}
