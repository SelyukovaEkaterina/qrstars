import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateQRCode } from "@/lib/utils";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
        data: { code },
      })
    )
  );

  return NextResponse.json({ codes: created });
}
