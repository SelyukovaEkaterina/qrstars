import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import prisma from "@/lib/prisma";
import { generateQRCode } from "@/lib/utils";

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json();
  const { count = 10, prefix = "" } = body;

  if (count > 100) {
    return NextResponse.json({ error: "Max 100 codes at once" }, { status: 400 });
  }

  const codes = [];
  for (let i = 0; i < count; i++) {
    let code: string;
    let exists = true;
    while (exists) {
      code = prefix ? `${prefix}${generateQRCode()}` : generateQRCode();
      const found = await prisma.qRCode.findUnique({ where: { code } });
      if (!found) {
        exists = false;
        codes.push(code);
      }
    }
  }

  const created = await Promise.all(
    codes.map((code) =>
      prisma.qRCode.create({
        data: { code, source: "MARKETPLACE" },
      })
    )
  );

  return NextResponse.json({ codes: created });
}
