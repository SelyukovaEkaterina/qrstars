import BatchActivateForm from "@/components/activate/BatchActivateForm";

interface BatchActivatePageProps {
  params: Promise<{ masterCode: string }>;
}

export default async function BatchActivatePage({ params }: BatchActivatePageProps) {
  const { masterCode } = await params;
  return <BatchActivateForm initialMasterCode={decodeURIComponent(masterCode)} />;
}
