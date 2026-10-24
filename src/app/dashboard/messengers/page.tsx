import { redirect } from "next/navigation";

export default function MessengersPage() {
  redirect("/dashboard/settings#notification-channels");
}
