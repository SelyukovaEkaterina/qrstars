import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const DEMO_ESTABLISHMENT_NAME = "Кофейня «Бобр»";
const DEMO_QR_CODES = ["abc12345", "def67890", "ghi11111"] as const;
const UNACTIVATED_QR_CODE = "xyz99999";

async function main() {
  console.log("Seeding database...");

  const hashedPassword = await bcrypt.hash("demo1234", 12);

  const user = await prisma.user.upsert({
    where: { email: "demo@smartreview.ru" },
    update: {},
    create: {
      email: "demo@smartreview.ru",
      name: "Демо Владелец",
      phone: "+79991234567",
      hashedPassword,
      role: "OWNER",
    },
  });

  console.log("User created:", user.email);

  const adminPassword = await bcrypt.hash("admin1234", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@smartreview.ru" },
    update: {},
    create: {
      email: "admin@smartreview.ru",
      name: "Админ",
      phone: "+79990000000",
      hashedPassword: adminPassword,
      role: "ADMIN",
    },
  });

  console.log("Admin created:", admin.email);

  let establishment = await prisma.establishment.findFirst({
    where: { userId: user.id, name: DEMO_ESTABLISHMENT_NAME },
  });

  if (!establishment) {
    establishment = await prisma.establishment.create({
      data: {
        name: DEMO_ESTABLISHMENT_NAME,
        address: "г. Москва, ул. Примерная, 42",
        phone: "+74951234567",
        yandexMapsUrl: "https://yandex.ru/maps/org/coffee_bobr/12345",
        twoGisUrl: "https://2gis.ru/moscow/branches/12345",
        userId: user.id,
      },
    });
    console.log("Establishment created:", establishment.name);
  } else {
    console.log("Establishment exists:", establishment.name);
  }

  const qrCodes = await Promise.all(
    DEMO_QR_CODES.map((code) =>
      prisma.qRCode.upsert({
        where: { code },
        update: {
          isActive: true,
          establishmentId: establishment.id,
          userId: user.id,
        },
        create: {
          code,
          isActive: true,
          establishmentId: establishment.id,
          userId: user.id,
          scansCount: Math.floor(Math.random() * 100) + 10,
        },
      })
    )
  );

  console.log("QR codes ready:", qrCodes.length);

  const unactivatedQR = await prisma.qRCode.upsert({
    where: { code: UNACTIVATED_QR_CODE },
    update: { isActive: false, establishmentId: null },
    create: {
      code: UNACTIVATED_QR_CODE,
      isActive: false,
    },
  });

  console.log("Unactivated QR code:", unactivatedQR.code);

  const existingReviews = await prisma.review.count({
    where: { establishmentId: establishment.id },
  });

  if (existingReviews === 0) {
    const ratings = [5, 5, 4, 5, 3, 5, 4, 2, 5, 1, 5, 4, 5, 3, 5];
    const comments = [
      "Отличный кофе!",
      "Очень вкусно, приду ещё!",
      "Хорошее обслуживание",
      "Лучший кофе в районе",
      "Долго ждали заказ",
      "Топ!",
      "Приятно удивлены",
      "Холодный кофе, ужас",
      "Рекомендую всем",
      "Грязно на столах",
      "Супер!",
      "Хорошее место",
      "Вернёмся ещё",
      "Официант грубил",
      "Класс!",
    ];

    await Promise.all(
      ratings.map((rating, i) => {
        const daysAgo = Math.floor(Math.random() * 30);
        const createdAt = new Date();
        createdAt.setDate(createdAt.getDate() - daysAgo);

        return prisma.review.create({
          data: {
            establishmentId: establishment.id,
            qrCodeId: qrCodes[Math.floor(Math.random() * qrCodes.length)].id,
            rating,
            comment: comments[i],
            guestName: `Гость ${i + 1}`,
            isNegative: rating <= 3,
            isProcessed: rating <= 3 ? Math.random() > 0.5 : true,
            createdAt,
          },
        });
      })
    );
    console.log("Reviews created:", ratings.length);
  } else {
    console.log("Reviews exist:", existingReviews);
  }

  const existingSubscription = await prisma.subscription.findFirst({
    where: { userId: user.id },
  });

  if (!existingSubscription) {
    const subscription = await prisma.subscription.create({
      data: {
        plan: "FREE",
        status: "ACTIVE",
        userId: user.id,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });
    console.log("Subscription created:", subscription.plan);
  } else {
    console.log("Subscription exists:", existingSubscription.plan);
  }

  console.log("\n=== DEMO CREDENTIALS ===");
  console.log("Email:    demo@smartreview.ru");
  console.log("Password: demo1234");
  console.log("Dashboard: http://localhost:3000/dashboard");
  console.log("Scan demo: http://localhost:3000/scan/abc12345");
  console.log("Activate:  http://localhost:3000/activate/xyz99999");
  console.log("");
  console.log("=== ADMIN CREDENTIALS ===");
  console.log("Email:    admin@smartreview.ru");
  console.log("Password: admin1234");
  console.log("Admin:    http://localhost:3000/admin");
  console.log("========================\n");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
