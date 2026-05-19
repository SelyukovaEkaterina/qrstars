import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { uploadObject, deleteObject } from "@/lib/s3";
import {
  FILE_MAX_SIZE,
  getFileExtension,
  normalizeContentType,
} from "@/lib/file-assets";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as Record<string, unknown>).id as string;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = (formData.get("title") as string | null)?.trim() || null;
  const replaceId = formData.get("replaceId") as string | null;

  if (!file) {
    return NextResponse.json({ error: "Файл не передан" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
  }

  if (file.size > FILE_MAX_SIZE) {
    return NextResponse.json(
      { error: "Максимальный размер файла — 25 МБ" },
      { status: 400 }
    );
  }

  if (replaceId) {
    const existing = await prisma.fileAsset.findFirst({
      where: { id: replaceId, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = normalizeContentType(file.type, file.name);
  const ext = getFileExtension(file.name, contentType);
  const key = `files/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  let fileUrl: string;
  try {
    fileUrl = await uploadObject(key, buffer, contentType);
  } catch (e) {
    console.error("S3 upload error:", e);
    return NextResponse.json({ error: "Ошибка загрузки в хранилище" }, { status: 500 });
  }

  if (replaceId) {
    const old = await prisma.fileAsset.findFirst({
      where: { id: replaceId, userId },
    });
    if (old) {
      try {
        await deleteObject(old.fileKey);
      } catch (e) {
        console.error("S3 delete old file:", e);
      }
      const fileAsset = await prisma.fileAsset.update({
        where: { id: replaceId },
        data: {
          title: title || old.title,
          fileName: file.name,
          fileUrl,
          fileKey: key,
          mimeType: contentType,
          fileSize: file.size,
        },
      });
      return NextResponse.json({ fileAsset });
    }
  }

  const fileAsset = await prisma.fileAsset.create({
    data: {
      title: title || file.name.replace(/\.[^.]+$/, ""),
      fileName: file.name,
      fileUrl,
      fileKey: key,
      mimeType: contentType,
      fileSize: file.size,
      userId,
    },
  });

  return NextResponse.json({ fileAsset });
}
