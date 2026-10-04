import { z, defineCollection } from 'astro:content';

const stepSchema = z.object({
  icon: z.string(),
  title: z.string(),
  text: z.string(),
});

const industrySchema = z.object({
  icon: z.string(),
  name: z.string(),
});

const faqSchema = z.object({
  q: z.string(),
  a: z.string(),
});

const relatedSchema = z.object({
  slug: z.string().optional(),
  href: z.string().optional(),
  label: z.string(),
});

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.date(),
    updatedDate: z.date().optional(),
    image: z.string().optional(),
    tags: z.array(z.string()).optional(),
    h1: z.string().optional(),
    fullTitle: z.boolean().optional(),
    ctaText: z.string().optional(),
    ctaHref: z.string().optional(),
    faq: z.array(faqSchema).optional(),
  }),
});

const seoCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    canonical: z.string().url().optional(),
    /** Снять страницу с индекса (каннибализация кластера «генератор») */
    noindex: z.boolean().optional(),
    h1: z.string(),
    badge: z.string().optional(),
    intro: z.string(),
    fullTitle: z.boolean().default(true),
    ctaText: z.string().default('Создать QR-код бесплатно'),
    ctaHref: z.string().default('/#features'),
    ctaGoal: z.string().optional(),
    ctaSecondaryText: z.string().optional(),
    ctaSecondaryHref: z.string().optional(),
    ctaSecondaryGoal: z.string().optional(),
    stickyCta: z.boolean().optional(),
    howItWorks: z.array(stepSchema).optional(),
    forWhom: z.array(industrySchema).optional(),
    faq: z.array(faqSchema),
    related: z.array(relatedSchema).optional(),
    demoScanUrl: z.string().url().optional(),
    demoScanLabel: z.string().optional(),
    demoScanTitle: z.string().optional(),
    demoScanSubtitle: z.string().optional(),
  }),
});

export const collections = {
  blog: blogCollection,
  seo: seoCollection,
};
