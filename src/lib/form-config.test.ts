import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FORM_PRESETS,
  fieldHasOptions,
  formatFieldValue,
  isFormFieldType,
  submissionsToCsv,
  validateFieldValue,
} from "./form-config";

const field = (type: string, extra: Record<string, unknown> = {}) =>
  ({ label: "Поле", type, required: false, options: null, ...extra }) as Parameters<typeof validateFieldValue>[0];

describe("validateFieldValue", () => {
  it("rating — только целые 1–5", () => {
    assert.deepEqual(validateFieldValue(field("rating"), 4), { ok: true, value: 4 });
    assert.deepEqual(validateFieldValue(field("rating"), "5"), { ok: true, value: 5 });
    assert.equal(validateFieldValue(field("rating"), 0).ok, false);
    assert.equal(validateFieldValue(field("rating"), 4.5).ok, false);
  });

  it("nps — 0–10", () => {
    assert.deepEqual(validateFieldValue(field("nps"), 0), { ok: true, value: 0 });
    assert.equal(validateFieldValue(field("nps"), 11).ok, false);
  });

  it("radio и select — только вариант из списка", () => {
    const f = field("radio", { options: ["Да", "Нет"] });
    assert.deepEqual(validateFieldValue(f, "Да"), { ok: true, value: "Да" });
    assert.equal(validateFieldValue(f, "Может быть").ok, false);
    assert.equal(validateFieldValue(field("select", { options: ["А"] }), ["А"]).ok, false);
  });

  it("multi — массив вариантов из списка в порядке списка", () => {
    const f = field("multi", { options: ["А", "Б", "В"] });
    assert.deepEqual(validateFieldValue(f, ["В", "А"]), { ok: true, value: ["А", "В"] });
    assert.equal(validateFieldValue(f, ["А", "Г"]).ok, false);
  });

  it("обязательное поле", () => {
    assert.equal(validateFieldValue(field("multi", { required: true, options: ["А"] }), []).ok, false);
    assert.equal(validateFieldValue(field("text", { required: true }), "  ").ok, false);
    assert.equal(validateFieldValue(field("checkbox", { required: true }), false).ok, false);
    assert.deepEqual(validateFieldValue(field("rating", { required: false }), ""), { ok: true, value: null });
  });

  it("текст обрезается и не принимает объекты", () => {
    const res = validateFieldValue(field("text"), "a".repeat(3000));
    assert.equal(res.ok && (res.value as string).length, 2000);
    assert.equal(validateFieldValue(field("text"), { x: 1 }).ok, false);
  });
});

describe("шаблоны форм", () => {
  it("уникальные id, допустимые типы, у списков есть варианты", () => {
    const ids = FORM_PRESETS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const p of FORM_PRESETS) {
      for (const f of p.fields) {
        assert.ok(isFormFieldType(f.type), `${p.id}: ${f.type}`);
        if (fieldHasOptions(f.type)) assert.ok((f.options ?? []).length >= 2, `${p.id}: ${f.label}`);
      }
    }
  });
});

describe("formatFieldValue и CSV", () => {
  it("форматирует оценки и списки", () => {
    assert.equal(formatFieldValue("rating", 4), "4 из 5 ★");
    assert.equal(formatFieldValue("nps", 9), "9 из 10");
    assert.equal(formatFieldValue("multi", ["А", "Б"]), "А, Б");
    assert.equal(formatFieldValue("checkbox", true), "Да");
    assert.equal(formatFieldValue("text", ""), "—");
  });

  it("CSV: BOM, «;», кавычки и защита от формул", () => {
    const csv = submissionsToCsv(
      [
        { id: "a", label: "Имя", type: "text" },
        { id: "b", label: "Комментарий", type: "textarea" },
      ],
      [{ createdAt: "2026-11-15T10:00:00Z", values: { a: "=HYPERLINK()", b: 'с "кавычками"; и точкой' }, qrLabel: "Стол 1" }]
    );
    assert.ok(csv.startsWith("﻿Дата;Имя;Комментарий;QR-код\r\n"));
    assert.ok(csv.includes("'=HYPERLINK()"));
    assert.ok(csv.includes('"с ""кавычками""; и точкой"'));
    assert.ok(csv.endsWith(";Стол 1"));
  });
});
