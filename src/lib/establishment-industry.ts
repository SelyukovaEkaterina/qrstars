export const ESTABLISHMENT_INDUSTRIES = [
  "HORECA",
  "BEAUTY",
  "AUTO",
  "CLINIC",
  "HOTEL",
  "OTHER",
] as const;

export type EstablishmentIndustry = (typeof ESTABLISHMENT_INDUSTRIES)[number];

export const INDUSTRY_OPTIONS: Array<{
  value: EstablishmentIndustry;
  label: string;
}> = [
  { value: "HORECA", label: "Кафе / ресторан" },
  { value: "BEAUTY", label: "Бьюти" },
  { value: "AUTO", label: "Авто" },
  { value: "CLINIC", label: "Клиника" },
  { value: "HOTEL", label: "Отель" },
  { value: "OTHER", label: "Другое" },
];

export function parseEstablishmentIndustry(
  value: unknown
): EstablishmentIndustry | null {
  return typeof value === "string" &&
    ESTABLISHMENT_INDUSTRIES.includes(value as EstablishmentIndustry)
    ? (value as EstablishmentIndustry)
    : null;
}

export function inferIndustryFromUtm(
  ...values: Array<string | null | undefined>
): EstablishmentIndustry | null {
  const haystack = values.filter(Boolean).join(" ").toLowerCase();
  if (/(авто|auto|avto|car|шиномонтаж|tire|автосервис)/i.test(haystack)) {
    return "AUTO";
  }
  if (/(beauty|бьюти|салон|парикмах|barber|маникюр)/i.test(haystack)) return "BEAUTY";
  if (/(clinic|клиник|стомат|stomat|dental|медицин|medical)/i.test(haystack)) {
    return "CLINIC";
  }
  if (/(hotel|отел|гостиниц|hostel)/i.test(haystack)) return "HOTEL";
  if (/(horeca|restaurant|ресторан|cafe|кафе|bar|бар|menu|меню)/i.test(haystack)) {
    return "HORECA";
  }
  return null;
}

export function isHorecaIndustry(industry: EstablishmentIndustry | null): boolean {
  return industry === "HORECA";
}

export function industryQrStylePreset(
  industry: EstablishmentIndustry | null
): string {
  switch (industry) {
    case "HORECA":
      return "cafe";
    case "BEAUTY":
      return "beauty";
    case "AUTO":
      return "auto";
    case "CLINIC":
      return "dentistry";
    case "HOTEL":
      return "hotel";
    default:
      return "classic";
  }
}

export type IndustryReviewCopy = {
  ratingQuestion: string;
  complaintTitle: string;
  complaintSubtitle: string;
  commentPlaceholder: string;
};

export function industryReviewCopy(
  industry: EstablishmentIndustry | null | undefined
): IndustryReviewCopy {
  switch (industry) {
    case "HORECA":
      return {
        ratingQuestion: "Как вам всё понравилось?",
        complaintTitle: "Нам очень жаль! Расскажите подробнее",
        complaintSubtitle: "Что можно было сделать лучше?",
        commentPlaceholder: "Что пошло не так? Мы хотим исправиться.",
      };
    case "BEAUTY":
      return {
        ratingQuestion: "Как вам результат и обслуживание?",
        complaintTitle: "Расскажите, что вас не устроило",
        complaintSubtitle: "Мы хотим исправить ситуацию.",
        commentPlaceholder: "Что в услуге или обслуживании можно улучшить?",
      };
    case "AUTO":
      return {
        ratingQuestion: "Как вам обслуживание?",
        complaintTitle: "Расскажите, что вас не устроило",
        complaintSubtitle: "Мы разберёмся и постараемся исправить ситуацию.",
        commentPlaceholder: "Что произошло при обслуживании автомобиля?",
      };
    case "CLINIC":
      return {
        ratingQuestion: "Как вам качество обслуживания?",
        complaintTitle: "Расскажите, что вас не устроило",
        complaintSubtitle: "Ваше сообщение поможет улучшить сервис.",
        commentPlaceholder: "Что в приёме или обслуживании можно улучшить?",
      };
    case "HOTEL":
      return {
        ratingQuestion: "Как прошло ваше пребывание?",
        complaintTitle: "Расскажите, что вас не устроило",
        complaintSubtitle: "Мы хотим сделать пребывание гостей комфортнее.",
        commentPlaceholder: "Что во время пребывания можно было сделать лучше?",
      };
    default:
      return {
        ratingQuestion: "Всё ли вас устроило?",
        complaintTitle: "Расскажите, что вас не устроило",
        complaintSubtitle: "Мы хотим исправить ситуацию.",
        commentPlaceholder: "Что можно улучшить?",
      };
  }
}
