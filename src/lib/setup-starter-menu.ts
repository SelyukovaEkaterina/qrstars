/** Базовое меню для онбординга intent=menu (без картинок — владелец дополнит в ЛК). */
export const STARTER_MENU_ITEMS = [
  {
    name: "Суп дня",
    category: "Закуски",
    price: "350 ₽",
    weight: "300 мл",
    description: "Сезонный суп — уточните состав у официанта.",
    order: 0,
  },
  {
    name: "Салат свежий",
    category: "Закуски",
    price: "420 ₽",
    weight: "250 г",
    description: "Овощи, зелень и заправка на выбор.",
    order: 1,
  },
  {
    name: "Горячее блюдо",
    category: "Основное",
    price: "650 ₽",
    weight: "320 г",
    description: "Фирменное блюдо заведения.",
    order: 2,
  },
  {
    name: "Десерт",
    category: "Десерты",
    price: "290 ₽",
    weight: "150 г",
    description: "Сладкое завершение ужина.",
    order: 3,
  },
] as const;

export function starterMenuCreateInput(establishmentId: string, establishmentName: string) {
  return {
    title: `Меню «${establishmentName}»`,
    // Описание видит гость: подсказки владельцу сюда не писать.
    description: null,
    estId: establishmentId,
    items: {
      create: STARTER_MENU_ITEMS.map((item) => ({
        name: item.name,
        category: item.category,
        price: item.price,
        weight: item.weight,
        description: item.description,
        order: item.order,
      })),
    },
  };
}
