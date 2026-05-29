import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  FORM_PRESETS,
  getPreset,
  isFormFieldType,
  normalizeFieldType,
  parseFieldOptions,
} from "@/lib/form-config";
import {
  establishmentAccessWhere,
  establishmentRelationWhere,
  establishmentHasPaidFeatures,
} from "@/lib/establishment-access";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { searchParams } = new URL(request.url);
  const establishmentId = searchParams.get("establishmentId");

  const where: Record<string, unknown> = establishmentRelationWhere(userId);
  if (establishmentId) where.establishmentId = establishmentId;

  const forms = await prisma.form.findMany({
    where,
    include: {
      fields: { orderBy: { order: "asc" } },
      _count: { select: { submissions: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ forms });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { establishmentId, presetId } = body as {
    establishmentId?: string;
    presetId?: string;
  };

  if (!establishmentId) {
    return NextResponse.json({ error: "establishmentId required" }, { status: 400 });
  }

  const est = await prisma.establishment.findFirst({
    where: { id: establishmentId, ...establishmentAccessWhere(userId) },
  });
  if (!est) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const preset = getPreset(presetId) ?? FORM_PRESETS[0];

  const form = await prisma.form.create({
    data: {
      establishment: { connect: { id: establishmentId } },
      title: preset.title,
      submitLabel: preset.submitLabel,
      successMessage: preset.successMessage,
      preset: preset.id,
      fields: {
        create: preset.fields.map((f, idx) => ({
          label: f.label,
          placeholder: f.placeholder ?? null,
          helpText: f.helpText ?? null,
          type: f.type,
          required: f.required,
          options: f.options ?? undefined,
          order: idx,
        })),
      },
    },
    include: { fields: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ form });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const body = await request.json();
  const { id, title, description, submitLabel, successMessage, enabled, fields } =
    body as {
      id?: string;
      title?: string;
      description?: string | null;
      submitLabel?: string;
      successMessage?: string;
      enabled?: boolean;
      fields?: Array<{
        id?: string;
        label?: string;
        placeholder?: string | null;
        helpText?: string | null;
        type?: string;
        required?: boolean;
        options?: unknown;
        order?: number;
      }>;
    };

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await prisma.form.findFirst({
    where: { id, ...establishmentRelationWhere(userId) },
    include: { fields: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isPro = await establishmentHasPaidFeatures(existing.establishmentId);

  if (Array.isArray(fields) && !isPro && fields.length > existing.fields.length) {
    return NextResponse.json(
      { error: "Добавление новых полей доступно только на PRO-тарифе" },
      { status: 403 }
    );
  }

  const data: Record<string, unknown> = {};
  if (typeof title === "string") data.title = title.trim().slice(0, 200) || existing.title;
  if (description !== undefined) data.description = description ? String(description).slice(0, 500) : null;
  if (typeof submitLabel === "string") data.submitLabel = submitLabel.trim().slice(0, 60) || existing.submitLabel;
  if (typeof successMessage === "string") data.successMessage = successMessage.trim().slice(0, 500) || existing.successMessage;
  if (typeof enabled === "boolean") data.enabled = enabled;

  if (Array.isArray(fields)) {
    const incomingIds = fields.filter((f) => f.id).map((f) => f.id as string);
    const toDelete = existing.fields.filter((f) => !incomingIds.includes(f.id));

    await prisma.$transaction(async (tx) => {
      await tx.form.update({ where: { id }, data });

      if (toDelete.length > 0) {
        await tx.formField.deleteMany({
          where: { id: { in: toDelete.map((f) => f.id) } },
        });
      }

      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const fieldData = {
          label: (f.label ?? "").trim().slice(0, 120) || "Поле",
          placeholder: f.placeholder ? String(f.placeholder).slice(0, 120) : null,
          helpText: f.helpText ? String(f.helpText).slice(0, 200) : null,
          type: normalizeFieldType(f.type),
          required: !!f.required,
          options: isFormFieldType(f.type) && f.type === "select" ? parseFieldOptions(f.options) ?? undefined : undefined,
          order: typeof f.order === "number" ? f.order : i,
        };

        if (f.id && existing.fields.some((ef) => ef.id === f.id)) {
          await tx.formField.update({ where: { id: f.id }, data: fieldData });
        } else {
          await tx.formField.create({
            data: { ...fieldData, form: { connect: { id } } },
          });
        }
      }
    });
  } else if (Object.keys(data).length > 0) {
    await prisma.form.update({ where: { id }, data });
  }

  const updated = await prisma.form.findUnique({
    where: { id },
    include: { fields: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json({ form: updated });
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const existing = await prisma.form.findFirst({
    where: { id, ...establishmentRelationWhere(userId) },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.form.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
