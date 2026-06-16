import { redirect } from "next/navigation";
import { LEGAL_OFFER_URL } from "@/lib/legal-urls";

export default function OfferPage() {
  redirect(LEGAL_OFFER_URL);
}
