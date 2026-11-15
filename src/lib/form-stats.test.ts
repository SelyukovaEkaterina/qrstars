import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dailyCounts, parseStatsPeriod, scanConversion, summarizeFormAnswers } from "./form-stats";

const fields = [
  { id: "r", label: "Оценка", type: "rating" as const, options: null },
  { id: "n", label: "NPS", type: "nps" as const, options: null },
  { id: "m", label: "Что понравилось", type: "multi" as const, options: ["Еда", "Сервис"] },
  { id: "c", label: "Новости", type: "checkbox" as const, options: null },
  { id: "t", label: "Комментарий", type: "textarea" as const, options: null },
];

describe("summarizeFormAnswers", () => {
  const answers = [
    { r: 5, n: 10, m: ["Еда", "Сервис"], c: true, t: "Супер" },
    { r: 4, n: 9, m: ["Еда"], c: false, t: "" },
    { r: 2, n: 3, m: ["Атмосфера"], t: null },
    { n: 7 },
  ];
  const [rating, nps, multi, checkbox, text] = summarizeFormAnswers(fields, answers);

  it("rating: среднее и распределение 1–5", () => {
    assert.equal(rating.answered, 3);
    assert.equal(rating.average, 3.7);
    assert.deepEqual(rating.distribution?.map((d) => d.count), [0, 1, 0, 1, 1]);
  });

  it("nps: промоутеры минус критики", () => {
    // 2 промоутера (10, 9), 1 критик (3), 1 нейтральный (7) из 4 → 25.
    assert.equal(nps.nps, 25);
    assert.equal(nps.distribution?.length, 11);
  });

  it("multi: варианты по порядку, удалённые — отдельной строкой", () => {
    assert.deepEqual(multi.distribution, [
      { label: "Еда", count: 2 },
      { label: "Сервис", count: 1 },
      { label: "Старые варианты", count: 1 },
    ]);
  });

  it("checkbox: да / нет от всех ответов", () => {
    assert.deepEqual(checkbox.distribution, [
      { label: "Да", count: 1 },
      { label: "Нет", count: 3 },
    ]);
  });

  it("текст — только число заполненных, без содержимого", () => {
    assert.equal(text.answered, 1);
    assert.equal(text.distribution, undefined);
  });

  it("пустые ответы не ломают среднее", () => {
    const [r] = summarizeFormAnswers([fields[0]], []);
    assert.equal(r.average, null);
  });
});

describe("dailyCounts и конверсия", () => {
  it("дни МСК, включая сегодня", () => {
    const now = new Date("2026-11-15T20:00:00Z"); // 23:00 МСК 15.11
    const res = dailyCounts(
      [new Date("2026-11-15T21:30:00Z"), new Date("2026-11-15T10:00:00Z"), new Date("2026-11-13T12:00:00Z")],
      3,
      now
    );
    // 21:30Z 15.11 — это уже 16.11 по Москве, в окно не попадает.
    assert.deepEqual(res, [
      { date: "2026-11-13", count: 1 },
      { date: "2026-11-14", count: 0 },
      { date: "2026-11-15", count: 1 },
    ]);
  });

  it("конверсия и период", () => {
    assert.equal(scanConversion(5, 40), 12.5);
    assert.equal(scanConversion(3, 0), null);
    assert.equal(scanConversion(50, 10), 100);
    assert.equal(parseStatsPeriod("7"), 7);
    assert.equal(parseStatsPeriod("365"), 30);
  });
});
