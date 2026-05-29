import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadObject } from "@/lib/s3";
import {
  establishmentAccessWhere,
  getEstablishmentAccess,
  qrcodeAccessWhere,
} from "@/lib/establishment-access";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE = 2 * 1024 * 1024;

// GET /api/tips-employees?establishmentId=…  (legacy: ?qrId=…)
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as Record<string, unknown>).id as string;

  const { searchParams } = new URL(request.url);
  let establishmentId = searchParams.get("establishmentId");
  const qrId = searchParams.get("qrId");

  if (!establishmentId && qrId) {
    const qr = await prisma.qRCode.findFirst({
      where: { id: qrId, ...qrcodeAccessWhere(userId) },
      select: { establishmentId: true },
    });
    if (!qr?.establishmentId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    establishmentId = qr.establishmentId;
  }

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId required" }, { status: 400 });
  }

  const access = await getEstablishmentAccess(userId, establishmentId);
  if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const employees = await prisma.tipsEmployee.findMany({
    where: { establishmentId },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ employees });
}

// POST /api/tips-employees  — create or update employee (multipart with optional photo)
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as Record<string, unknown>).id as string;

  const formData = await request.formData();
  let establishmentId = formData.get("establishmentId") as string | null;
  const qrId = formData.get("qrId") as string | null;
  const id = formData.get("id") as string | null;
  const name = (formData.get("name") as string | null)?.trim() || "";
  const paymentType = (formData.get("paymentType") as string | null) || "PHONE";
  const paymentUrl = (formData.get("paymentUrl") as string | null)?.trim() || null;
  const phone = (formData.get("phone") as string | null)?.trim() || null;
  const bankName = (formData.get("bankName") as string | null)?.trim() || null;
  const order = parseInt((formData.get("order") as string) || "0", 10);
  const photo = formData.get("photo") as File | null;

  if (!establishmentId && qrId) {
    const qr = await prisma.qRCode.findFirst({
      where: { id: qrId, ...qrcodeAccessWhere(userId) },
      select: { establishmentId: true },
    });
    establishmentId = qr?.establishmentId ?? null;
  }

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId required" }, { status: 400 });
  }
  if (!name) return NextResponse.json({ error: "Имя обязательно" }, { status: 400 });

  const access = await getEstablishmentAccess(userId, establishmentId);
  if (!access) return NextResponse.json({ error: "Заведение не найдено" }, { status: 404 });

  let photoUrl: string | null | undefined = undefined;

  if (photo && photo.size > 0) {
    if (!ALLOWED_TYPES.includes(photo.type)) {
      return NextResponse.json({ error: "Допустимы PNG, JPEG, WebP" }, { status: 400 });
    }
    if (photo.size > MAX_SIZE) {
      return NextResponse.json({ error: "Максимум 2 МБ" }, { status: 400 });
    }
    const buffer = Buffer.from(await photo.arrayBuffer());
    const ext = photo.name.split(".").pop() || "jpg";
    const key = `tips-employees/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    photoUrl = await uploadObject(key, buffer, photo.type);
  }

  const data: Record<string, unknown> = {
    establishmentId,
    name,
    paymentType,
    paymentUrl: paymentUrl || null,
    phone: phone || null,
    bankName: bankName || null,
    order,
  };
  if (photoUrl !== undefined) data.photoUrl = photoUrl;

  let employee;
  if (id) {
    const existing = await prisma.tipsEmployee.findFirst({
      where: { id, establishmentId },
    });
    if (!existing) return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });
    employee = await prisma.tipsEmployee.update({ where: { id }, data });
  } else {
    employee = await prisma.tipsEmployee.create({
      data: data as Parameters<typeof prisma.tipsEmployee.create>[0]["data"],
    });
  }

  return NextResponse.json({ employee });
}

// DELETE /api/tips-employees?id=…
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as Record<string, unknown>).id as string;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const emp = await prisma.tipsEmployee.findUnique({
    where: { id },
    select: { establishmentId: true },
  });
  if (!emp) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const access = await getEstablishmentAccess(userId, emp.establishmentId);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.tipsEmployee.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
