import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import RegisterForm from "./RegisterForm";
import { GENERATOR_STYLE_PARAM } from "@/lib/generator-style-keys";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const invite = params.establishmentInvite;
  const hasInvite = Array.isArray(invite) ? invite.some(Boolean) : Boolean(invite);
  const session = await getServerSession(authOptions);
  if (session?.user && !hasInvite) {
    // Уже вошёл, но пришёл из генератора с дизайном — донесём стиль до кабинета.
    const style = params[GENERATOR_STYLE_PARAM];
    const styleValue = Array.isArray(style) ? style[0] : style;
    redirect(
      styleValue
        ? `/dashboard/settings/templates?${GENERATOR_STYLE_PARAM}=${encodeURIComponent(styleValue)}`
        : "/dashboard",
    );
  }
  return <RegisterForm />;
}
