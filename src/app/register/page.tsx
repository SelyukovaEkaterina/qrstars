import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import RegisterForm from "./RegisterForm";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const invite = params.establishmentInvite;
  const hasInvite = Array.isArray(invite) ? invite.some(Boolean) : Boolean(invite);
  const session = await getServerSession(authOptions);
  if (session?.user && !hasInvite) redirect("/dashboard");
  return <RegisterForm />;
}
