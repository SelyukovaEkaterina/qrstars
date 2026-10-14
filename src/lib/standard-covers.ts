export interface CoverImage {
  id: string;
  url: string;
  name: string;
}

export const STANDARD_COVERS: CoverImage[] = [
  { id: "cover-coffee", name: "Кофейня", url: "/covers/coffee.jpg" },
  { id: "cover-restaurant", name: "Ресторан", url: "/covers/restaurant.jpg" },
  { id: "cover-barbershop", name: "Барбершоп", url: "/covers/barbershop.jpg" },
  { id: "cover-beauty", name: "Салон красоты", url: "/covers/beauty.jpg" },
  { id: "cover-auto", name: "Автосервис", url: "/covers/auto.jpg" },
  { id: "cover-fitness", name: "Фитнес", url: "/covers/fitness.jpg" },
  { id: "cover-hotel", name: "Отель", url: "/covers/hotel.jpg" },
  { id: "cover-abstract", name: "Абстракция", url: "/covers/abstract.jpg" },
];
