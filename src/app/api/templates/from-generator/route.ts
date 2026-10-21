import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requireDbUserId } from "@/lib/session-user";
import {
  GENERATOR_STYLE_SOURCE,
  GENERATOR_STYLE_TEMPLATE_NAME,
  generatorStyleToTemplateConfig,
  isGeneratorStyleLayout,
  parseGeneratorStyle,
  templateConfigKey,
} from "@/lib/generator-style";

/** Не даём бесконечно плодить шаблоны повторными заходами по ссылке. */
const MAX_GENERATOR_TEMPLATES = 10;

/**
 * POST /api/templates/from-generator — сохранить дизайн из генератора на лендинге
 * как стиль QR в «Шаблонах оформления». Тело: `{ style: "<base64url>" }`.
 * Повтор с тем же дизайном возвращает существующий шаблон (`created: false`).
 */
export async function POST(request: Request) {
  const auth = await requireDbUserId();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const userId = auth.userId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Некорректный запрос" }, { status: 400 });
  }
  const style = parseGeneratorStyle((body as { style?: unknown })?.style as string | undefined);
  if (!style) {
    return NextResponse.json({ error: "Некорректный стиль QR" }, { status: 400 });
  }

  const config = generatorStyleToTemplateConfig(style);
  // Мастер /dashboard/start применит стиль к первому QR (см. quick-start).
  const appliesToFirstQr = !(await prisma.qRCode.findFirst({ where: { userId }, select: { id: true } }));
  const configKey = templateConfigKey(config);

  const existing = await prisma.template.findMany({
    where: { userId },
    select: { id: true, name: true, layout: true },
    orderBy: { createdAt: "desc" },
  });
  const fromGenerator = existing.filter((t) => isGeneratorStyleLayout(t.layout));
  const same = fromGenerator.find(
    (t) => templateConfigKey((t.layout as { config?: unknown }).config) === configKey,
  );
  if (same) {
    return NextResponse.json({
      template: { id: same.id, name: same.name },
      created: false,
      appliesToFirstQr,
    });
  }
  if (fromGenerator.length >= MAX_GENERATOR_TEMPLATES) {
    return NextResponse.json(
      { error: "Слишком много стилей из генератора — удалите лишние в «Шаблонах оформления»" },
      { status: 429 },
    );
  }

  const template = await prisma.template.create({
    data: {
      name: GENERATOR_STYLE_TEMPLATE_NAME,
      description: "Перенесён из бесплатного генератора на qrstars.ru",
      layout: {
        __type: "qr-style",
        source: GENERATOR_STYLE_SOURCE,
        config,
      } as unknown as Prisma.InputJsonValue,
      user: { connect: { id: userId } },
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({ template, created: true, appliesToFirstQr });
}
