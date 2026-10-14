-- Standard covers are served from /covers/ instead of images.unsplash.com.
UPDATE "Establishment" SET "coverUrl" = CASE
  WHEN "coverUrl" LIKE '%photo-1497935586351-b67a49e012bf%' THEN '/covers/coffee.jpg'
  WHEN "coverUrl" LIKE '%photo-1517248135467-4c7edcad34c4%' THEN '/covers/restaurant.jpg'
  WHEN "coverUrl" LIKE '%photo-1585747860715-2ba37e788b70%' THEN '/covers/barbershop.jpg'
  WHEN "coverUrl" LIKE '%photo-1560066984-138dadb4c035%' THEN '/covers/beauty.jpg'
  WHEN "coverUrl" LIKE '%photo-1619642751034-765dfdf7c58e%' THEN '/covers/auto.jpg'
  WHEN "coverUrl" LIKE '%photo-1534438327276-14e5300c3a48%' THEN '/covers/fitness.jpg'
  WHEN "coverUrl" LIKE '%photo-1566073771259-6a8506099945%' THEN '/covers/hotel.jpg'
  WHEN "coverUrl" LIKE '%photo-1557682250-33bd709cbe85%' THEN '/covers/abstract.jpg'
  ELSE "coverUrl"
END
WHERE "coverUrl" LIKE '%images.unsplash.com%';
