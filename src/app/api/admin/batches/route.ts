import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { generateQRCode, generateSerialCode, generateMasterCode } from "@/lib/utils";

export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const batches = await prisma.activationBatch.findMany({
    include: {
      qrcodes: {
        select: { id: true, code: true, serialCode: true, isActive: true },
        orderBy: { serialCode: "asc" },
      },
      user: { select: { id: true, email: true, name: true } },
      establishment: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ batches });
}

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { qty, label } = body;

  if (!qty || qty < 1 || qty > 100) {
    return NextResponse.json({ error: "qty must be 1-100" }, { status: 400 });
  }

  let masterCode: string;
  let exists = true;
  while (exists) {
    masterCode = generateMasterCode();
    const found = await prisma.activationBatch.findUnique({ where: { masterCode } });
    if (!found) exists = false;
  }

  const batch = await prisma.activationBatch.create({
    data: {
      masterCode: masterCode!,
      qty,
      label: label || null,
    },
  });

  const qrCodes = [];
  for (let i = 0; i < qty; i++) {
    let code: string;
    let codeExists = true;
    while (codeExists) {
      code = generateQRCode();
      const found = await prisma.qRCode.findUnique({ where: { code } });
      if (!found) codeExists = false;
    }

    let serialCode: string;
    let serialExists = true;
    while (serialExists) {
      serialCode = generateSerialCode();
      const found = await prisma.qRCode.findFirst({
        where: { batchId: batch.id, serialCode },
      });
      if (!found) serialExists = false;
    }

    const qr = await prisma.qRCode.create({
      data: {
        code: code!,
        serialCode: serialCode!,
        source: "MARKETPLACE",
        isActive: false,
        batch: { connect: { id: batch.id } },
      },
    });
    qrCodes.push(qr);
  }

  return NextResponse.json({
    batch: {
      id: batch.id,
      masterCode: batch.masterCode,
      qty: batch.qty,
      label: batch.label,
    },
    qrcodes: qrCodes,
  });
}
