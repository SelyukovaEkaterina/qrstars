import { redirect } from "next/navigation";
import { TEMPLATE_ROUTES } from "@/lib/template-routes";

export default function TableTentTemplatesPage() {
  redirect(TEMPLATE_ROUTES.qr);
}
