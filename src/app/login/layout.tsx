import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import IncidentBanner from "@/components/IncidentBanner";

export default async function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/dashboard");
  return (
    <>
      <IncidentBanner restoreHref="/restore" />
      {children}
    </>
  );
}
