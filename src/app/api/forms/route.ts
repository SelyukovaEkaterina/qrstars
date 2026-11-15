import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  FORM_MAX_FIELDS,
  FORM_PRESETS,
  fieldHasOptions,
  getPreset,
  normalizeFieldType,
  parseFieldOptions,
} from "@/lib/form-config";
import { establishmentAccessWhere, establishmentRelationWhere } from "@/lib/establishment-access";
import { formCreateFromPreset } from "@/lib/form-create";
import { BUSINESS_CARD_LEAD_FORM_PRESET } from "@/lib/business-card-leads";
import { collectContentCacheTargets, invalidateCacheTargets, invalidateContentCache } from "@/lib/content-cache";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;
  const { searchParams } = new URL(request.url);
  const establishmentId = searchParams.get("establishmentId");

  const where: Record<string, unknown> = {
    ...establishmentRelationWhere(userId),
    // Системная форма заявок с визитки — не для редактора микросайта.
    OR: [{ preset: null }, { preset: { not: BUSINESS_CARD_LEAD_FORM_PRESET } }],
  };
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
  const { establishmentId, presetId, title, enabled } = body as {
    establishmentId?: string;
    presetId?: string;
    title?: string;
    /** Для отдельного QR-анкеты форму включаем сразу; в микросайте — после настройки. */
    enabled?: boolean;
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
      ...formCreateFromPreset(preset, { title, enabled: enabled === true }),
    },
    include: { fields: { orderBy: { order: "asc" } } },
  });

  invalidateContentCache("form", form.id);
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

  // Поля и их типы доступны на всех тарифах; на FREE ограничено число заявок в месяц.
  if (Array.isArray(fields) && fields.length > FORM_MAX_FIELDS) {
    return NextResponse.json(
      { error: `В форме может быть не больше ${FORM_MAX_FIELDS} полей` },
      { status: 400 }
    );
  }
  if (Array.isArray(fields)) {
    for (const f of fields) {
      if (fieldHasOptions(normalizeFieldType(f.type)) && (parseFieldOptions(f.options)?.length ?? 0) < 2) {
        return NextResponse.json(
          { error: `Добавьте хотя бы два варианта ответа в поле «${(f.label ?? "").trim() || "без названия"}»` },
          { status: 400 }
        );
      }
    }
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
          options: fieldHasOptions(normalizeFieldType(f.type)) ? parseFieldOptions(f.options) ?? undefined : Prisma.DbNull,
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

  invalidateContentCache("form", id);
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

  const cacheTargets = await collectContentCacheTargets("form", id);
  await prisma.form.delete({ where: { id } });
  void invalidateCacheTargets(cacheTargets);
  return NextResponse.json({ ok: true });
}
