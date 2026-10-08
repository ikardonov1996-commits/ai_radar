export const TOPICS = [
  { slug: "productivity", label: "Продуктивность и планирование", short: "Продуктивность", query: "AI planner productivity" },
  { slug: "study", label: "Учёба", short: "Учёба", query: "AI study homework tutor" },
  { slug: "writing", label: "Тексты и письмо", short: "Тексты", query: "AI writing assistant" },
  { slug: "design", label: "Изображения и дизайн", short: "Дизайн", query: "AI image generator art" },
  { slug: "video", label: "Видео и монтаж", short: "Видео", query: "AI video editor" },
  { slug: "audio", label: "Музыка и аудио", short: "Аудио", query: "AI music generator" },
  { slug: "code", label: "Код и разработка", short: "Код", query: "AI coding assistant" },
  { slug: "business", label: "Бизнес и маркетинг", short: "Маркетинг", query: "AI marketing business" },
  { slug: "finance", label: "Финансы", short: "Финансы", query: "AI budget finance" },
  { slug: "health", label: "Здоровье и спорт", short: "Здоровье", query: "AI fitness workout" },
  { slug: "photo", label: "Фото", short: "Фото", query: "AI photo editor" },
  { slug: "social", label: "Общение и компаньоны", short: "Общение", query: "AI chat companion" },
] as const;

export type TopicSlug = (typeof TOPICS)[number]["slug"];
export const TOPIC_SLUGS: string[] = TOPICS.map((t) => t.slug);

export function topicBySlug(slug: string) {
  return TOPICS.find((t) => t.slug === slug);
}

export function topicLabel(slugs: string[]): string {
  const t = slugs.map(topicBySlug).find(Boolean);
  return t ? `AI / ${t.short}` : "AI";
}

export function cleanTopics(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((s): s is string => typeof s === "string" && TOPIC_SLUGS.includes(s)))];
}

export const SURVEY_REASONS = [
  "Экономит время",
  "Интересная идея",
  "Нужно для работы или учёбы",
  "Красивое демо",
  "Не видел такого раньше",
  "Другое",
] as const;
