import { permanentRedirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ScanRedirectPage({ params }: Props) {
  const { id } = await params;
  permanentRedirect(`/q/${id}`);
}
