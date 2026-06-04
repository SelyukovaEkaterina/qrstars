import prisma from "@/lib/prisma";
import { collectClientInfo } from "@/lib/client-info";
import { establishmentHasPaidFeatures } from "@/lib/establishment-access";
import { userHasPaidFeatures } from "@/lib/subscription-utils";

interface RecordQrScanParams {
  qrCodeId: string;
  establishmentId?: string | null;
  headers: Headers;
}

async function shouldLogDetailedScan(
  qrCodeId: string,
  establishmentId?: string | null
): Promise<boolean> {
  if (establishmentId) {
    return establishmentHasPaidFeatures(establishmentId);
  }

  const qr = await prisma.qRCode.findUnique({
    where: { id: qrCodeId },
    select: { userId: true },
  });
  if (!qr?.userId) return false;
  return userHasPaidFeatures(qr.userId);
}

export function recordQrScan({
  qrCodeId,
  establishmentId,
  headers,
}: RecordQrScanParams): void {
  void (async () => {
    try {
      const logDetailed = await shouldLogDetailedScan(qrCodeId, establishmentId);

      if (!logDetailed) {
        await prisma.qRCode.update({
          where: { id: qrCodeId },
          data: { scansCount: { increment: 1 } },
        });
        return;
      }

      const client = await collectClientInfo({ headers } as Request);
      await prisma.$transaction([
        prisma.qRCode.update({
          where: { id: qrCodeId },
          data: { scansCount: { increment: 1 } },
        }),
        prisma.qRScan.create({
          data: {
            qrCodeId,
            establishmentId: establishmentId ?? null,
            ip: client.ip.slice(0, 45),
            region: client.region.slice(0, 200),
            browser: client.browser.slice(0, 100),
            device: client.device.slice(0, 100),
          },
        }),
      ]);
    } catch {
      // best-effort logging
    }
  })();
}
