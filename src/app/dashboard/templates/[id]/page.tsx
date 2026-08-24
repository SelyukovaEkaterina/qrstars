import { redirect } from "next/navigation";
import { TEMPLATE_ROUTES } from "@/lib/template-routes";

/** Old table-tent template links now land in the QR style library. */
export default function LegacyTemplateEditorPage() {
  redirect(TEMPLATE_ROUTES.qr);
}
