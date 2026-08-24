import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-auth";
import { sendPromoSurveyEmail } from "@/lib/mailer";

export async function POST(request: Request) {
  const { error } = await requireAdmin();
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret");
  
  if (error && secret !== process.env.CRON_SECRET) {
    return error;
  }

  try {
    const limit = parseInt(searchParams.get("limit") || "1000", 10);

    // 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find users who registered > 7 days ago and haven't filled the survey
    // and haven't received the email yet (we'll track this in UserLifecycleEmail)
    const users = await prisma.user.findMany({
      where: {
        createdAt: {
          lt: sevenDaysAgo,
        },
        promoSurveys: {
          none: {},
        },
        lifecycleEmails: {
          none: {
            campaignKey: "promo_survey_2026_08",
          },
        },
      },
      select: {
        id: true,
        email: true,
      },
      take: limit,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://app.qrstars.ru";

    let sentCount = 0;
    for (const user of users) {
      const surveyUrl = `${baseUrl}/promo-survey?email=${encodeURIComponent(user.email)}`;
      const success = await sendPromoSurveyEmail(user.email, surveyUrl);
      if (success) {
        sentCount++;
        await prisma.userLifecycleEmail.create({
          data: {
            userId: user.id,
            campaignKey: "promo_survey_2026_08",
          },
        });
      }
      // slight delay to avoid rate limits if we have many users
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return NextResponse.json({
      success: true,
      sentCount,
      totalEligible: users.length,
    });
  } catch (err) {
    console.error("send-promo-survey error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
