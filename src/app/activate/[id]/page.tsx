import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import ActivateForm from "@/components/activate/ActivateForm";

interface ActivatePageProps {
  params: Promise<{ id: string }>;
}

export default async function ActivatePage({ params }: ActivatePageProps) {
  const { id } = await params;

  const qrCode = await prisma.qRCode.findUnique({
    where: { code: id },
  });

  if (!qrCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <div className="text-5xl">❓</div>
          <h1 className="text-2xl font-bold text-gray-900">QR-код не найден</h1>
          <p className="text-gray-500">Проверьте правильность кода.</p>
        </div>
      </div>
    );
  }

  if (qrCode.isActive) {
    redirect(`/scan/${id}`);
  }

  return <ActivateForm qrCodeId={qrCode.id} code={id} />;
}
