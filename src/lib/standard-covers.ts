export interface CoverImage {
  id: string;
  url: string;
  name: string;
}

export const STANDARD_COVERS: CoverImage[] = [
  {
    id: "cover-coffee",
    name: "Кофейня",
    url: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "cover-restaurant",
    name: "Ресторан",
    url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "cover-barbershop",
    name: "Барбершоп",
    url: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "cover-beauty",
    name: "Салон красоты",
    url: "https://images.unsplash.com/photo-1560066984-138dadb4c035?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "cover-auto",
    name: "Автосервис",
    url: "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "cover-fitness",
    name: "Фитнес",
    url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "cover-hotel",
    name: "Отель",
    url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1000&auto=format&fit=crop",
  },
  {
    id: "cover-abstract",
    name: "Абстракция",
    url: "https://images.unsplash.com/photo-1557682250-33bd709cbe85?q=80&w=1000&auto=format&fit=crop",
  },
];
