import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { notifyPromoSurveyResponse } from "@/lib/telegram-support";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, answers } = body;

    if (!email || !answers) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        subscriptions: {
          where: { status: "ACTIVE" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Пользователь с таким email не найден" },
        { status: 404 }
      );
    }

    // 2. Check if they already filled the survey
    const existingSurvey = await prisma.promoSurveyResponse.findFirst({
      where: {
        OR: [{ email }, { userId: user.id }],
      },
    });

    if (existingSurvey) {
      return NextResponse.json(
        { error: "Вы уже заполняли эту анкету" },
        { status: 400 }
      );
    }

    // 3. Save the survey
    const ipAddress = request.headers.get("x-forwarded-for") || undefined;
    const userAgent = request.headers.get("user-agent") || undefined;

    await prisma.promoSurveyResponse.create({
      data: {
        email,
        userId: user.id,
        answers,
        ipAddress,
        userAgent,
      },
    });

    // 4. Grant PRO logic
    const activeSub = user.subscriptions[0];
    const THREE_MONTHS_MS = 3 * 30 * 24 * 60 * 60 * 1000;

    if (activeSub && activeSub.plan !== "FREE") {
      // User already has PRO or NETWORK. Extend by 3 months.
      const baseDate =
        activeSub.currentPeriodEnd && activeSub.currentPeriodEnd > new Date()
          ? activeSub.currentPeriodEnd
          : new Date();
      const newEnd = new Date(baseDate.getTime() + THREE_MONTHS_MS);

      await prisma.subscription.update({
        where: { id: activeSub.id },
        data: { currentPeriodEnd: newEnd },
      });
    } else {
      // User is on FREE. Cancel any old subscriptions just in case, then create PRO
      if (activeSub && activeSub.plan === "FREE") {
        await prisma.subscription.update({
          where: { id: activeSub.id },
          data: { status: "CANCELED" },
        });
      }

      await prisma.subscription.create({
        data: {
          userId: user.id,
          plan: "PRO",
          status: "ACTIVE",
          billing: "promo_survey", // custom billing marker
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + THREE_MONTHS_MS),
        },
      });
    }

    // 5. Notify to Telegram Support group
    try {
      await notifyPromoSurveyResponse({
        userId: user.id,
        email,
        answers: answers as Record<string, string>,
      });
    } catch (tgErr) {
      console.error("Failed to notify tg about promo survey:", tgErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("promo-survey error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
