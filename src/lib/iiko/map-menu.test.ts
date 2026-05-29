import assert from "node:assert/strict";
import { mapIikoMenuResponse } from "./map-menu";

const fixture = {
  name: "Сайт/приложение",
  itemCategories: [
    {
      name: "Десерты",
      isHidden: false,
      items: [
        {
          itemId: "abc-123",
          name: "Печенье",
          description: "Сладкое",
          itemSizes: [
            {
              isDefault: true,
              isHidden: false,
              portionWeightGrams: 50,
              sizeId: "size-1",
              prices: [{ organizationId: "org-1", price: 150 }],
            },
          ],
        },
      ],
    },
    {
      name: "Скрытое",
      isHidden: true,
      items: [{ itemId: "hidden", name: "X", itemSizes: [{ isDefault: true, prices: [{ price: 1 }] }] }],
    },
  ],
};

const { items, productIndex } = mapIikoMenuResponse(fixture, "org-1");

assert.equal(items.length, 1);
assert.equal(items[0].name, "Печенье");
assert.equal(items[0].category, "Десерты");
assert.equal(items[0].price, "150 ₽");
assert.equal(items[0].iikoProductId, "abc-123");
assert.ok(productIndex.has("abc-123"));

const { items: filtered } = mapIikoMenuResponse(fixture, "org-1", {
  hiddenCategoryIds: ["name:десерты"],
});
assert.equal(filtered.length, 0);

console.log("map-menu.test.ts: ok");
